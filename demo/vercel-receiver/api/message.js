const BROKER_URL = process.env.PIGEON_URL || "https://pigeon-broker-demo.fly.dev";
const CONSUMER_TOKEN = process.env.PIGEON_DEMO_RECEIVER_TOKEN || "demo-consumer-token";
const SUBJECT = "demo.message";

function deny(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function demoHeaders(contractId) {
  const headers = {
    "content-type": "application/json",
    "x-pigeon-region": "uk",
    authorization: `Bearer ${CONSUMER_TOKEN}`
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

  const { scenario, mode, runId, subject, sessionId } = req.body ?? {};
  if (JSON.stringify(req.body ?? {}).length > 8192 || scenario !== "message" || !["allow", "violation"].includes(mode) ||
      !/^demo_[a-z0-9]{12}$/.test(runId ?? "") || subject !== SUBJECT || !/^[a-f0-9-]{36}$/.test(sessionId ?? "")) {
    return deny(res, 400, "BAD_REQUEST", "Invalid encrypted message receiver request.");
  }

  const basePath = `/demo/sessions/${sessionId}`;
  try {
    const contractCall = await broker(`${basePath}/v1/contracts`, {
      method: "POST",
      body: { subjects: [SUBJECT] }
    });
    if (!contractCall.response.ok || !contractCall.payload?.contract?.id) {
      throw new Error(contractCall.payload?.error?.message || "Consumer contract negotiation failed.");
    }
    const contract = contractCall.payload.contract;

    const receiveCall = await broker(`${basePath}/v1/subjects/${SUBJECT}/receive`, {
      method: "POST",
      contractId: contract.id,
      body: { max: 10 }
    });
    if (!receiveCall.response.ok) throw new Error(receiveCall.payload?.error?.message || "Receiver could not read the subject.");

    const messages = receiveCall.payload?.messages ?? [];
    const received = messages.find((item) => item?.data?.demoRunId === runId) ?? null;
    let ack = null;
    let ackMs = 0;
    if (received) {
      const ackCall = await broker(`${basePath}/v1/subjects/${SUBJECT}/messages/${encodeURIComponent(received.id)}/ack`, {
        method: "POST",
        contractId: contract.id,
        body: {}
      });
      if (!ackCall.response.ok || ackCall.payload?.status !== "acked") {
        throw new Error(ackCall.payload?.error?.message || "Receiver acknowledgement failed.");
      }
      ack = ackCall.payload;
      ackMs = ackCall.ms;
    }

    if (mode === "allow" && !received) throw new Error("The encrypted message was accepted but not delivered to the receiver.");
    if (mode === "violation" && received) throw new Error("A policy-denied message reached the receiver.");

    const [auditCall, quarantineCall] = await Promise.all([
      broker(`${basePath}/v1/audit`),
      broker(`${basePath}/v1/quarantine`)
    ]);
    if (!auditCall.response.ok || !quarantineCall.response.ok) throw new Error("Could not load demo evidence.");

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      scenario: "message",
      runId,
      receivedCount: received ? 1 : 0,
      proof: received ? "Ciphertext delivered and acknowledged." : "Policy stopped the message before delivery.",
      received: received ? {
        messageId: received.id,
        algorithm: received.data.algorithm,
        iv: received.data.iv,
        ciphertext: received.data.ciphertext,
        plaintextBytes: received.data.plaintextBytes,
        acked: ack?.status === "acked"
      } : null,
      audit: auditCall.payload.records ?? [],
      quarantine: quarantineCall.payload.records ?? [],
      timings: {
        contractMs: contractCall.ms,
        receiveMs: receiveCall.ms,
        ackMs,
        evidenceMs: Math.max(auditCall.ms, quarantineCall.ms),
        totalMs: contractCall.ms + receiveCall.ms + ackMs + Math.max(auditCall.ms, quarantineCall.ms)
      }
    });
  } catch (error) {
    return deny(res, 502, "BROKER_UNAVAILABLE", error instanceof Error ? error.message : "Encrypted message receiver failed.");
  } finally {
    fetch(`${BROKER_URL}${basePath}`, { method: "DELETE", signal: AbortSignal.timeout(3000) }).catch(() => {});
  }
}
