import assert from "node:assert/strict";
import { PigeonClient } from "../sdk/typescript/pigeon-client.mjs";
import { proxyDemo } from "../src/website-proxy.js";

// With --proxy, exercise the local website adapter against the three live services.
// With a URL, exercise the deployed website and all services end to end.
const localProxy = process.argv[2] === "--proxy";
const base = localProxy ? "http://website.test" : (process.argv[2] || "https://www.pigeonmq.cc").replace(/\/$/, "");
const transport = (url, options = {}) => localProxy
  ? proxyDemo(new Request(url, options))
  : fetch(url, { ...options, signal: AbortSignal.timeout(25000) });
const status = await transport(`${base}/health`);
assert.equal(status.status, 200, await status.text());

const ids = await Promise.all([1, 2].map(async () => {
  const response = await transport(`${base}/demo/sessions`, { method: "POST" });
  const created = await response.json();
  assert.equal(response.status, 201, JSON.stringify(created));
  const url = base + created.session.basePath;
  try {
    const sender = new PigeonClient({ url, token: "checkout-token", fetchImpl: transport });
    const receiver = new PigeonClient({ url, token: "gateway-token", fetchImpl: transport });
    await sender.connect(["payments.authorize"]);
    await receiver.connect(["payments.authorize"]);
    const data = { merchantId: "merchant_demo", orderId: "isolation-check", amount: 42.5, currency: "GBP", paymentToken: "tok_demo" };
    const options = { intent: "authorize_payment", idempotencyKey: "same-key-in-both-sessions", classification: "pci", region: "uk" };
    const accepted = await sender.request("payments.authorize", data, options);
    assert.equal(accepted.status, "accepted");
    const messages = await receiver.receive("payments.authorize", { max: 10 });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, accepted.message.id);
    assert.equal((await receiver.ack("payments.authorize", messages[0].id)).status, "acked");
    const duplicate = await sender.request("payments.authorize", data, options);
    assert.equal(duplicate.status, "duplicate");
    assert.equal(duplicate.message.id, accepted.message.id);
    assert.deepEqual(await receiver.receive("payments.authorize"), []);
    await assert.rejects(() => sender.request("payments.authorize", { ...data, card: { pan: "4111111111111111" } }, { ...options, idempotencyKey: "forbidden" }), { code: "SENSITIVE_FIELD_DENIED" });
    assert.equal((await receiver.quarantine())[0].message.data.card.pan, "[REDACTED]");
    const unauthorized = new PigeonClient({ url, token: "catalog-token", fetchImpl: transport });
    await assert.rejects(() => unauthorized.connect(["payments.authorize"]), { code: "NO_PERMITTED_SUBJECTS" });
    assert.deepEqual(await receiver.receive("payments.authorize"), []);
    assert.equal((await receiver.audit()).filter((r) => r.type === "delivery.acked" && r.messageId === accepted.message.id).length, 1);
    return accepted.message.id;
  } finally {
    const removed = await transport(url, { method: "DELETE" });
    assert.equal(removed.status, 200);
  }
}));
assert.notEqual(ids[0], ids[1]);
console.log("PASS: live sender → broker → receiver → acknowledgement; duplicate suppressed; forbidden data redacted; unauthorized sender denied; concurrent visitors isolated.");
