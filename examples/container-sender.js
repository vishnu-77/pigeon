const pigeonUrl = process.env.PIGEON_URL ?? "http://localhost:8787";
const token = process.env.PIGEON_TOKEN ?? "checkout-token";

process.on("SIGTERM", () => process.exit(0));

await waitForBroker();

// Authenticate + negotiate a session contract before publishing anything (FND-01/02).
const contractId = await negotiate(["payments.authorize"]);
console.log(`[sender] negotiated contract ${contractId}`);

const message = {
  subject: "payments.authorize",
  type: "payment.authorization.requested",
  source: "checkout-service",
  intent: "authorize_payment",
  idempotencyKey: "order_container_001:authorize",
  classification: "pci",
  region: "uk",
  data: {
    merchantId: "merchant_container",
    orderId: "order_container_001",
    amount: 73.25,
    currency: "GBP",
    paymentToken: "tok_container_visa"
  }
};

console.log("[sender] publishing payment authorization to Pigeon");
const accepted = await publish(message);
console.log("[sender] accepted response");
console.log(JSON.stringify(accepted, null, 2));

console.log("[sender] retrying with the same idempotency key");
const duplicate = await publish(message);
console.log("[sender] duplicate response");
console.log(JSON.stringify(duplicate, null, 2));

console.log("[sender] trying to publish raw PAN, expected to be denied and quarantined");
const denied = await publish({
  ...message,
  idempotencyKey: "order_container_002:authorize",
  data: {
    ...message.data,
    orderId: "order_container_002",
    card: { pan: "4111111111111111" }
  }
}, false);
console.log(JSON.stringify(denied, null, 2));

if (process.env.SENDER_HOLD_OPEN === "true") {
  console.log("[sender] holding container open so receiver can finish the simulation");
  setInterval(() => {}, 60_000);
}

async function negotiate(subjects) {
  const response = await fetch(`${pigeonUrl}/v1/contracts`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "x-pigeon-region": "uk" },
    body: JSON.stringify({ subjects })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Negotiate failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload.contract.id;
}

async function publish(body, expectOk = true) {
  const response = await fetch(`${pigeonUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-pigeon-contract": contractId,
      "x-pigeon-region": "uk"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (expectOk && !response.ok) {
    throw new Error(`Publish failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function waitForBroker() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(`${pigeonUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until Docker health and service DNS settle.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Broker did not become healthy at ${pigeonUrl}`);
}
