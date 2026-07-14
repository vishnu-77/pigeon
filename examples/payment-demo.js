import { PigeonBroker, PigeonError } from "../src/index.js";
import { createPaymentBroker } from "../src/subjects.js";

const broker = createPaymentBroker(PigeonBroker);

const checkout = {
  principal: { id: "spiffe://merchant-prod/ns/checkout/sa/checkout-api" },
  region: "uk"
};

const attacker = {
  principal: { id: "spiffe://merchant-prod/ns/catalog/sa/catalog-api" },
  region: "uk"
};

const gateway = {
  principal: { id: "spiffe://merchant-prod/ns/payments/sa/gateway-adapter" },
  region: "uk"
};

function tryStep(name, fn) {
  try {
    const result = fn();
    console.log(`\n${name}`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof PigeonError) {
      console.log(`\n${name}`);
      console.log(JSON.stringify({ denied: true, code: error.code, message: error.message }, null, 2));
      return;
    }
    throw error;
  }
}

// Each principal negotiates a session contract; every operation runs under it.
const checkoutSession = broker.connect(checkout, { subjects: ["payments.authorize"] });
const gatewaySession = broker.connect(gateway, { subjects: ["payments.authorize"] });

tryStep("1. governed payment authorization accepted", () => checkoutSession.request("payments.authorize", {
  merchantId: "merchant_123",
  orderId: "order_456",
  amount: 42.5,
  currency: "GBP",
  paymentToken: "tok_visa_abc"
}, {
  intent: "authorize_payment",
  idempotencyKey: "order_456:authorize",
  classification: "pci",
  region: "uk"
}));

tryStep("2. retry with same idempotency key is deduplicated", () => checkoutSession.request("payments.authorize", {
  merchantId: "merchant_123",
  orderId: "order_456",
  amount: 42.5,
  currency: "GBP",
  paymentToken: "tok_visa_abc"
}, {
  intent: "authorize_payment",
  idempotencyKey: "order_456:authorize",
  classification: "pci",
  region: "uk"
}));

tryStep("3. unauthorized producer is denied - no contract is issued", () => broker.connect(attacker, { subjects: ["payments.authorize"] }));

tryStep("4. raw PAN is denied and quarantined", () => checkoutSession.request("payments.authorize", {
  merchantId: "merchant_123",
  orderId: "order_999",
  amount: 15,
  currency: "GBP",
  paymentToken: "tok_visa_xyz",
  card: { pan: "4111111111111111" }
}, {
  intent: "authorize_payment",
  idempotencyKey: "order_999:authorize",
  classification: "pci",
  region: "uk"
}));

tryStep("5. gateway receives only authorized messages", () => gatewaySession.receive("payments.authorize", { max: 10 }));

tryStep("6. replay is denied by subject policy", () => gatewaySession.replay("payments.authorize", { reason: "debug" }));

console.log("\nAudit trail");
console.log(JSON.stringify(broker.listAudit(), null, 2));

console.log("\nQuarantine");
console.log(JSON.stringify(broker.listQuarantine(), null, 2));
