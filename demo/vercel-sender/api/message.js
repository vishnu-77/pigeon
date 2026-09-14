const pigeonUrl = process.env.PIGEON_URL || "https://broker.pigeonmq.cc";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Use POST." });
  }

  const { runId, mode = "allow", message = "Hello from Pigeon" } = request.body || {};
  if (!runId || typeof runId !== "string") {
    return response.status(400).json({ error: "runId is required." });
  }
  if (mode !== "allow" && mode !== "violation") {
    return response.status(400).json({ error: "mode must be allow or violation." });
  }

  const config = {
    subject: "demo.message",
    token: process.env.PIGEON_DEMO_TOKEN || "demo-producer-token",
    intent: "send_demo_message",
    type: "demo.message.created",
    classification: "internal",
    region: "uk"
  };

  const totalStarted = Date.now();

  try {
    const contractStarted = Date.now();
    const contract = await negotiate(config);
    const contractMs = Date.now() - contractStarted;

    const text = normaliseMessage(message);
    const data = {
      demoRunId: runId,
      message: text,
      ...(mode === "violation" ? { restricted: { secret: "demo-value" } } : {})
    };

    const envelope = {
      subject: config.subject,
      type: config.type,
      source: "pigeon-public-demo",
      intent: config.intent,
      idempotencyKey: `${runId}:message:${mode}`,
      classification: config.classification,
      region: config.region,
      data
    };

    const publishStarted = Date.now();
    const published = await publish(config, contract.id, envelope);
    const publishMs = Date.now() - publishStarted;
    const accepted = published.ok;
    const errorCode = published.payload?.error?.code || null;
    const decision = accepted ? "allow" : mode === "violation" ? "quarantine" : "deny";
    const failGate = gateFromError(errorCode);

    return response.status(200).json({
      service: "sender",
      scenario: "message",
      mode,
      runId,
      subject: config.subject,
      contract: { id: contract.id, expiresAt: contract.expiresAt },
      message: {
        id: published.payload?.message?.id || null,
        subject: config.subject,
        preview: text,
        idempotencyKey: envelope.idempotencyKey
      },
      decision,
      errorCode,
      gates: ["identity", "intent", "schema", "region", "data", "idempotency"].map((name) => ({
        name,
        pass: accepted || name !== failGate,
        reason: name === failGate ? errorCode : undefined
      })),
      brokerStatus: published.status,
      timings: {
        contractMs,
        publishMs,
        totalMs: Date.now() - totalStarted
      }
    });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

async function negotiate(config) {
  const res = await fetch(`${pigeonUrl}/v1/contracts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.token}`,
      "x-pigeon-region": config.region
    },
    body: JSON.stringify({ subjects: [config.subject] })
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(`Contract negotiation failed: ${res.status} ${JSON.stringify(payload)}`);
  return payload.contract;
}

async function publish(config, contractId, message) {
  const res = await fetch(`${pigeonUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.token}`,
      "x-pigeon-contract": contractId,
      "x-pigeon-region": config.region
    },
    body: JSON.stringify(message)
  });
  return { ok: res.ok, status: res.status, payload: await res.json() };
}

function normaliseMessage(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || "Hello from Pigeon").slice(0, 280);
}

function gateFromError(code) {
  if (!code) return "data";
  if (code.includes("INTENT")) return "intent";
  if (code.includes("SCHEMA")) return "schema";
  if (code.includes("REGION")) return "region";
  if (code.includes("DUPLICATE") || code.includes("IDEMPOT")) return "idempotency";
  if (code.includes("CONTRACT") || code.includes("AUTH")) return "identity";
  return "data";
}
