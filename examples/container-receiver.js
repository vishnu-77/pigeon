import assert from "node:assert/strict";
import { SUBJECT, connect, createClient, until } from "./demo-client.js";

const client = createClient("gateway-token");
const contract = await connect(client);
console.log(`[receiver] negotiated contract ${contract.id}`);
console.log("[receiver] waiting for governed payment messages");

const messages = await until(async () => {
  const batch = await client.receive(SUBJECT, { max: 10 });
  return batch.length > 0 ? batch : null;
}, "payment messages; start npm run simulate:sender");

for (const message of messages) {
  assert.equal(message.data.card?.pan, undefined, "Forbidden PAN reached the receiver");
  assert.equal(message.data.merchantId, "merchant_container", "Use an isolated broker for the container demo");
  if (process.env.DEMO_RUN_ID) {
    assert.equal(message.data.orderId, `order_container_${process.env.DEMO_RUN_ID}`);
  }
  console.log(`[receiver] received ${message.id} (${message.data.orderId})`);

  // Receipt can race the sender's retry and denial. Verify this order's evidence.
  const evidence = await until(async () => {
    const [audit, quarantine] = await Promise.all([client.audit(), client.quarantine()]);
    const denied = quarantine.find((record) => record.subject === SUBJECT &&
      record.message.idempotencyKey === `${message.data.orderId}:denied` &&
      record.code === "SENSITIVE_FIELD_DENIED");
    const accepted = audit.some((record) => record.type === "publish.accepted" && record.messageId === message.id);
    const duplicate = audit.some((record) => record.type === "publish.duplicate" && record.messageId === message.id);
    const quarantined = denied && audit.some((record) => record.type === "quarantine.created" && record.quarantineId === denied.id);
    return accepted && duplicate && quarantined ? denied : null;
  }, `acceptance, duplicate and quarantine evidence for ${message.data.orderId}`);
  assert.equal(evidence.message.data.card.pan, "[REDACTED]");
  console.log(`[receiver] verified duplicate suppression and redacted quarantine ${evidence.id}`);

  const ack = await client.ack(SUBJECT, message.id);
  assert.equal(ack.status, "acked");
  assert.ok(ack.message.ackedBy.some((entry) => entry.principal === contract.principal));
  const audit = await client.audit();
  assert.ok(audit.some((record) => record.type === "delivery.acked" && record.messageId === message.id));
  console.log(`[receiver] acknowledged ${message.id}`);
}
console.log(`[receiver] complete: ${messages.length} governed payment(s) verified and acknowledged`);
