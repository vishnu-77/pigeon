const pigeonUrl = process.env.PIGEON_URL || "https://broker.pigeonmq.cc";

const scenarios = {
  payments: {
    subject: "payments.authorize",
    token: process.env.PIGEON_PAYMENT_RECEIVER_TOKEN || "gateway-token",
    region: "uk"
  },
  notifications: {
    subject: "notifications.send",
    token: process.env.PIGEON_NOTIFICATION_RECEIVER_TOKEN || "notifier-token",
    region: "uk"
  }
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Use POST." });
  }

  const { scenario = "payments", mode = "violation", runId } = request.body || {};
  if (!runId || typeof runId !== "string") {
    return response.status(400).json({ error: "runId is required." });
  }

  const config = scenarios[scenario];
  if (!config) {
    return response.status(501).json({
      error: `Scenario '${scenario}' is not broker-backed yet.`,
      supportedScenarios: Object.keys(scenarios)
    });
  }

  try {
    const contract = await negotiate(config);
    let delivered = [];

    if (mode === "allow") {
      for (let attempt = 0; attempt < 5 && delivered.length === 0; attempt += 1) {
        const received = await receive(config, contract.id);
        delivered = (received.messages || []).filter((message) => message?.data?.demoRunId === runId);
        if (delivered.length === 0) await sleep(400);
      }
    } else {
      // A violating message should never become deliverable. One bounded receive
      // verifies that the selected run is absent without keeping a serverless
      // invocation open unnecessarily.
      const received = await receive(config, contract.id);
      delivered = (received.messages || []).filter((message) => message?.data?.demoRunId === runId);
    }

    const [audit, quarantine] = await Promise.all([
      getJson(config, "/v1/audit"),
      getJson(config, "/v1/quarantine")
    ]);

    const runAudit = extractArray(audit).filter((entry) => JSON.stringify(entry).includes(runId));
    const runQuarantine = extractArray(quarantine).filter((entry) => JSON.stringify(entry).includes(runId));

    return response.status(200).json({
      service: "receiver",
      scenario,
      mode,
      runId,
      subject: config.subject,
      contract: { id: contract.id, expiresAt: contract.expiresAt },
      receivedCount: delivered.length,
      delivered,
      audit: runAudit,
      quarantine: runQuarantine,
      proof: mode === "violation"
        ? delivered.length === 0
          ? "receiver_did_not_receive_violating_message"
          : "unexpected_delivery"
        : delivered.length > 0
          ? "receiver_received_allowed_message"
          : "message_not_observed"
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

async function receive(config, contractId) {
  const res = await fetch(`${pigeonUrl}/v1/subjects/${encodeURIComponent(config.subject)}/receive`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.token}`,
      "x-pigeon-contract": contractId,
      "x-pigeon-region": config.region
    },
    body: JSON.stringify({ max: 50 })
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(`Receive failed: ${res.status} ${JSON.stringify(payload)}`);
  return payload;
}

async function getJson(config, path) {
  const res = await fetch(`${pigeonUrl}${path}`, {
    headers: { authorization: `Bearer ${config.token}` }
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${JSON.stringify(payload)}`);
  return payload;
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["audit", "events", "entries", "records", "quarantine", "items"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
