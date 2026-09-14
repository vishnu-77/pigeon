import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PigeonClientError } from "../sdk/typescript/pigeon-client.mjs";
import { SUBJECT, connect, createClient, until } from "./demo-client.js";

process.on("SIGTERM", () => process.exit(0));

const client = createClient("checkout-token");
const contract = await connect(client);
console.log(`[sender] negotiated contract ${contract.id}`);

// A fresh order per run permits repeat demos against the same durable broker.
const runId = process.env.DEMO_RUN_ID || randomUUID();
const orderId = `order_container_${runId}`;
const message = {
  subject: SUBJECT,
  type: "payment.authorization.requested",
  source: "checkout-service",
  intent: "authorize_payment",
  idempotencyKey: `${orderId}:authorize`,
  classification: "pci",
  region: "uk",
  data: {
    merchantId: "merchant_container", orderId, amount: 73.25,
    currency: "GBP", paymentToken: "tok_container_visa"
  }
};

const accepted = await client.publish(message);
assert.equal(accepted.status, "accepted", "Use a fresh DEMO_RUN_ID for each run");
console.log(`[sender] accepted ${accepted.message.id} (${orderId})`);

const duplicate = await client.publish(message);
assert.equal(duplicate.status, "duplicate");
assert.equal(duplicate.message.id, accepted.message.id);
console.log(`[sender] duplicate returned original ${duplicate.message.id}`);

await assert.rejects(() => client.publish({
  ...message,
  idempotencyKey: `${orderId}:denied`,
  data: { ...message.data, card: { pan: "4111111111111111" } }
}), (error) => error instanceof PigeonClientError &&
  error.status === 422 && error.code === "SENSITIVE_FIELD_DENIED");
console.log("[sender] raw PAN denied: SENSITIVE_FIELD_DENIED");

await until(async () => (await client.audit()).some((record) =>
  record.type === "delivery.acked" && record.messageId === accepted.message.id
), `receiver acknowledgement of ${accepted.message.id}; start npm run simulate:receiver`);
console.log(`[sender] complete: receiver acknowledged ${accepted.message.id}`);

if (process.env.SENDER_HOLD_OPEN === "true") {
  // Compose's one-shot command uses the receiver's exit code to stop the stack.
  setInterval(() => {}, 60_000);
}
