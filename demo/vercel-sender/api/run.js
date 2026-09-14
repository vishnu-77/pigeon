const pigeonUrl = process.env.PIGEON_URL || "https://broker.pigeonmq.cc";

const scenarios = {
  payments: {
    subject: "payments.authorize",
    token: process.env.PIGEON_PAYMENT_TOKEN || "checkout-token",
    intent: "authorize_payment",
    type: "payment.authorization.requested",
    classification: "pci",
    region: "uk",
    allowedData(runId) {
      return {
        demoRunId: runId,
        merchantId: "merchant_demo",
        orderId: `order_${runId}`,
        amount: 73.25,
        currency: "GBP",
        paymentToken: "tok_demo_visa"
      };
    },
    violatingData(runId) {
      return {
        ...this.allowedData(runId),
        card: { pan: "4111111111111111" }
      };
    }
  },
  notifications: {
    subject: "notifications.send",
    token: process.env.PIGEON_NOTIFICATION_TOKEN || "orders-token",
    intent: "send_notification",
    type: "notification.send.requested",
    classification: "pii",
    region: "uk",
    allowedData(runId) {
      return {
        demoRunId: runId,
        recipientId: `customer_${runId}`,
        channel: "email",
        templateId: "order-confirmed",
        locale: "en-GB",
        params: { orderRef: runId }
      };
    },
    violatingData(runId) {
      return {
        ...this.allowedData(runId),
        recipient: { ssn: "123-45-6789" }
      };
    }
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
  if (mode !== "allow" && mode !== "violation") {
    return response.status(400).json({ error: "mode must be allow or violation." });
  }

  try {
    const contract = await negotiate(config);
    const data = mode === "allow" ? config.allowedData(runId) : config.violatingData(runId);
    const message = {
      subject: config.subject,
      type: config.type,
      source: "pigeon-public-demo",
      intent: config.intent,
      idempotencyKey: `${runId}:${scenario}:${mode}`,
      classification: config.classification,
      region: config.region,
      data
    };

    const published = await publish(config, contract.id, message);
    const accepted = published.ok;
    const errorCode = published.payload?.error?.code || null;
    const decision = accepted ? "allow" : mode === "violation" ? "quarantine" : "deny";
    const failGate = gateFromError(errorCode);

    return response.status(200).json({
      service: "sender",
      scenario,
      mode,
      runId,
      subject: config.subject,
      contract: { id: contract.id, expiresAt: contract.expiresAt },
      message: {
        id: published.payload?.message?.id || null,
        subject: config.subject,
        idempotencyKey: message.idempotencyKey
      },
      decision,
      errorCode,
      gates: ["identity", "intent", "schema", "region", "data", "idempotency"].map((name) => ({
        name,
        pass: accepted || name !== failGate,
        reason: name === failGate ? errorCode : undefined
      })),
      brokerStatus: published.status
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

function gateFromError(code) {
  if (!code) return "data";
  if (code.includes("INTENT")) return "intent";
  if (code.includes("SCHEMA")) return "schema";
  if (code.includes("REGION")) return "region";
  if (code.includes("DUPLICATE") || code.includes("IDEMPOT")) return "idempotency";
  if (code.includes("CONTRACT") || code.includes("AUTH")) return "identity";
  return "data";
}
