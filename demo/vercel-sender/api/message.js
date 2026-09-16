const BROKER_URL = process.env.PIGEON_URL || "https://pigeon-broker-demo.fly.dev";
const PRODUCER_TOKEN = process.env.PIGEON_DEMO_TOKEN || "demo-producer-token";
const SUBJECT = "demo.message";

function deny(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function validEncrypted(value) {
  return value && value.algorithm === "AES-256-GCM" &&
    typeof value.iv === "string" && /^[A-Za-z0-9_-]{16,32}$/.test(value.iv) &&
    typeof value.ciphertext === "string" && /^[A-Za-z0-9_-]{16,2048}$/.test(value.ciphertext) &&
    Number.isSafeInteger(value.plaintextBytes) && value.plaintextBytes >= 0 && value.plaintextBytes <= 2048;
}

function demoHeaders(contractId) {
  const headers = {
    "content-type": "application/json",
    "x-pigeon-region": "uk",
    authorization: `Bearer ${PRODUCER_TOKEN}`
  };
  if (contractId) headers["x-pigeon-contract"] = contractId;
  return headers;
}

async function broker(path, { method = "GET", body, contractId, auth = true } = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${BROKER_URL}${path}`, {
    method,
    headers: auth ? demoHeaders(contractId) : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({ error: { code: "INVALID_RESPONSE", message: "Broker returned non-JSON." } }));
  return { response, payload, ms: Math.round(performance.now() - startedAt) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return deny(res, 405, "METHOD_NOT_ALLOWED", "Use POST.");
  if (req.headers["x-pigeon-demo"] !== "website") return deny(res, 403, "DEMO_ORIGIN_REQUIRED", "This endpoint is used by the Pigeon demo orchestrator.");
  if (process.env.PIGEON_DEMO_SHARED_KEY && req.headers["x-pigeon-demo-key"] !== process.env.PIGEON_DEMO_SHARED_KEY) {
    return deny(res, 401, "DEMO_KEY_INVALID", "Demo service key is invalid.");
  }

  const { scenario, mode, runId, encrypted } = req.body ?? {};
  if (JSON.stringify(req.body ?? {}).length > 8192 || scenario !== "message" || !["allow", "violation"].includes(mode) ||
      !/^demo_[a-z0-9]{12}$/.test(runId ?? "") || !validEncrypted(encrypted)) {
    return deny(res, 400, "BAD_REQUEST", "Invalid encrypted message demo request.");
  }

  let session;
  try {
    const created = await broker("/demo/sessions", { method: "POST", body: {}, auth: false });
    if (!created.response.ok || !created.payload?.session?.basePath) throw new Error(created.payload?.error?.message || "Could not create demo session.");
    session = created.payload.session;

    const contractCall = await broker(`${session.basePath}/v1/contracts`, {
      method: "POST",
      body: { subjects: [SUBJECT] }
    });
    if (!contractCall.response.ok || !contractCall.payload?.contract?.id) {
      throw new Error(contractCall.payload?.error?.message || "Producer contract negotiation failed.");
    }
    const contract = contractCall.payload.contract;

    const data = {
      demoRunId: runId,
      algorithm: encrypted.algorithm,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      plaintextBytes: encrypted.plaintextBytes,
      ...(mode === "violation" ? { restricted: { secret: "policy-violation-probe" } } : {})
    };
    const publishCall = await broker(`${session.basePath}/v1/messages`, {
      method: "POST",
      contractId: contract.id,
      body: {
        subject: SUBJECT,
        type: "demo.message.encrypted",
        source: "demo-producer",
        intent: "send_demo_message",
        idempotencyKey: `${runId}:encrypted-message`,
        classification: "internal",
        region: "uk",
        data
      }
    });

    const brokerCode = publishCall.payload?.error?.code;
    const expectedDenied = mode === "violation" && brokerCode === "SENSITIVE_FIELD_DENIED";
    if (!publishCall.response.ok && !expectedDenied) {
      throw new Error(publishCall.payload?.error?.message || `Publish failed (${publishCall.response.status}).`);
    }
    if (mode === "violation" && !expectedDenied) throw new Error("The broker unexpectedly accepted the policy-violation probe.");
    if (mode === "allow" && publishCall.payload?.status !== "accepted") throw new Error("The broker did not accept the encrypted message.");

    const allowed = mode === "allow";
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      scenario: "message",
      runId,
      sessionId: session.id,
      subject: SUBJECT,
      decision: allowed ? "allow" : "deny",
      contract,
      gates: [
        { name: "identity", pass: true },
        { name: "intent", pass: true },
        { name: "schema", pass: true },
        { name: "region", pass: true },
        { name: "data", pass: allowed, reason: allowed ? "ciphertext payload allowed" : "restricted.secret denied by subject policy" },
        { name: "idempotency", pass: true }
      ],
      message: allowed ? {
        id: publishCall.payload.message.id,
        subject: SUBJECT,
        preview: `ciphertext:${encrypted.ciphertext.slice(0, 24)}…`
      } : {
        subject: SUBJECT,
        preview: `ciphertext:${encrypted.ciphertext.slice(0, 24)}…`
      },
      encryption: {
        algorithm: encrypted.algorithm,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        plaintextBytes: encrypted.plaintextBytes
      },
      timings: {
        contractMs: contractCall.ms,
        publishMs: publishCall.ms,
        totalMs: contractCall.ms + publishCall.ms
      }
    });
  } catch (error) {
    if (session?.basePath) {
      fetch(`${BROKER_URL}${session.basePath}`, { method: "DELETE", signal: AbortSignal.timeout(3000) }).catch(() => {});
    }
    return deny(res, 502, "BROKER_UNAVAILABLE", error instanceof Error ? error.message : "Encrypted message sender failed.");
  }
}
