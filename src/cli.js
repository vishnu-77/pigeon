#!/usr/bin/env node
import { PigeonBroker } from "./broker.js";
import { createPaymentBroker } from "./subjects.js";

const broker = createPaymentBroker(PigeonBroker);
const command = process.argv[2];

if (command === "demo") {
  const checkout = {
    principal: { id: "spiffe://merchant-prod/ns/checkout/sa/checkout-api" },
    region: "uk"
  };

  const gateway = {
    principal: { id: "spiffe://merchant-prod/ns/payments/sa/gateway-adapter" },
    region: "uk"
  };

  const publish = broker.request("payments.authorize", {
    merchantId: "merchant_123",
    orderId: "order_456",
    amount: 42.5,
    currency: "GBP",
    paymentToken: "tok_visa_abc"
  }, checkout, {
    intent: "authorize_payment",
    idempotencyKey: "order_456:authorize",
    classification: "pci",
    region: "uk"
  });

  const received = broker.receive("payments.authorize", gateway, { max: 10 });
  console.log(JSON.stringify({ publish, received, audit: broker.listAudit() }, null, 2));
} else {
  console.log("Usage: pigeon demo");
}
