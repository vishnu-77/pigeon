import test from "node:test";
import assert from "node:assert/strict";
import { DemoSessions } from "../src/demo-sessions.js";
import { createPigeonServer } from "../src/server.js";
import { PigeonClient } from "../sdk/typescript/pigeon-client.mjs";

test("isolated HTTP demo sessions publish, deduplicate, quarantine, receive and ack without crossing visitors", async (t) => {
  const server = createPigeonServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const sessions = await Promise.all([1, 2].map(async () => (await (await fetch(`${base}/demo/sessions`, { method: "POST" })).json()).session));
  assert.notEqual(sessions[0].id, sessions[1].id);
  const ids = await Promise.all(sessions.map(async (session) => {
    const url = base + session.basePath;
    const sender = new PigeonClient({ url, token: "checkout-token" });
    const receiver = new PigeonClient({ url, token: "gateway-token" });
    await sender.connect(["payments.authorize"]);
    await receiver.connect(["payments.authorize"]);
    const data = { merchantId: "m", orderId: "same-order", amount: 42.5, currency: "GBP", paymentToken: "tok" };
    const options = { intent: "authorize_payment", idempotencyKey: "same-key", classification: "pci", region: "uk" };
    const accepted = await sender.request("payments.authorize", data, options);
    const duplicate = await sender.request("payments.authorize", data, options);
    assert.equal(duplicate.status, "duplicate");
    assert.equal(duplicate.message.id, accepted.message.id);
    await assert.rejects(() => sender.request("payments.authorize", { ...data, card: { pan: "4111111111111111" } }, { ...options, idempotencyKey: "denied" }), { code: "SENSITIVE_FIELD_DENIED" });
    const messages = await receiver.receive("payments.authorize", { max: 10 });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, accepted.message.id);
    assert.equal((await receiver.ack("payments.authorize", messages[0].id)).status, "acked");
    assert.deepEqual(await receiver.receive("payments.authorize"), []);
    assert.equal((await sender.quarantine())[0].message.data.card.pan, "[REDACTED]");
    const attacker = new PigeonClient({ url, token: "catalog-token" });
    await assert.rejects(() => attacker.connect(["payments.authorize"]), { code: "NO_PERMITTED_SUBJECTS" });
    assert.equal((await sender.audit()).filter((r) => r.type === "delivery.acked").length, 1);
    return accepted.message.id;
  }));
  assert.notEqual(ids[0], ids[1]);
  const hostAudit = await (await fetch(`${base}/v1/audit`)).json();
  assert.equal(hostAudit.records.filter((r) => r.type === "publish.accepted").length, 0);
  const first = sessions[0];
  assert.equal((await fetch(`${base}${first.basePath}/v1/quarantine/nope/release`, { method: "POST" })).status, 404);
  await fetch(base + first.basePath, { method: "DELETE" });
  assert.equal((await fetch(`${base}${first.basePath}/v1/audit`)).status, 410);
  assert.equal((await fetch(`${base}${sessions[1].basePath}/v1/audit`)).status, 200);
});

test("demo sessions have bounded capacity, expiry and operations", () => {
  let now = 0;
  const sessions = new DemoSessions({ now: () => now, ttlMs: 100, capacity: 1 });
  const first = sessions.create();
  assert.throws(() => sessions.create(), { code: "RATE_LIMITED" });
  for (let i = 0; i < 150; i++) sessions.get(first.id);
  assert.throws(() => sessions.get(first.id), { code: "RATE_LIMITED" });
  now = 101;
  assert.throws(() => sessions.get(first.id), { code: "DEMO_EXPIRED" });
  assert.ok(sessions.create().id);
});
