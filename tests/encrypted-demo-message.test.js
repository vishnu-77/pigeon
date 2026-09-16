import test from "node:test";
import assert from "node:assert/strict";
import { createPigeonServer } from "../src/server.js";
import { PigeonClient } from "../sdk/typescript/pigeon-client.mjs";

test("isolated demo.message sessions carry ciphertext only, deliver, ack and quarantine violations", async (t) => {
  const server = createPigeonServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;

  const session = (await (await fetch(`${base}/demo/sessions`, { method: "POST" })).json()).session;
  const url = base + session.basePath;
  const sender = new PigeonClient({ url, token: "demo-producer-token" });
  const receiver = new PigeonClient({ url, token: "demo-consumer-token" });
  await sender.connect(["demo.message"]);
  await receiver.connect(["demo.message"]);

  const data = {
    demoRunId: "demo_123456789abc",
    algorithm: "AES-256-GCM",
    iv: "AAECAwQFBgcICQoL",
    ciphertext: "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcY",
    plaintextBytes: 17
  };
  const options = {
    intent: "send_demo_message",
    idempotencyKey: "demo_123456789abc:encrypted-message",
    classification: "internal",
    region: "uk"
  };

  const accepted = await sender.request("demo.message", data, options);
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.message.data.ciphertext, data.ciphertext);
  assert.equal("message" in accepted.message.data, false);

  const messages = await receiver.receive("demo.message", { max: 10 });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].data.ciphertext, data.ciphertext);
  assert.equal(messages[0].data.iv, data.iv);
  assert.equal((await receiver.ack("demo.message", messages[0].id)).status, "acked");

  await assert.rejects(
    () => sender.request("demo.message", { ...data, demoRunId: "demo_deadbeefcafe", restricted: { secret: "do-not-deliver" } }, { ...options, idempotencyKey: "demo_deadbeefcafe:encrypted-message" }),
    { code: "SENSITIVE_FIELD_DENIED" }
  );
  assert.deepEqual(await receiver.receive("demo.message", { max: 10 }), []);

  const quarantine = await sender.quarantine();
  assert.equal(quarantine.length, 1);
  assert.equal(quarantine[0].message.data.restricted.secret, "[REDACTED]");
  const audit = await sender.audit();
  assert.ok(audit.some((record) => record.type === "publish.accepted" && record.messageId === accepted.message.id));
  assert.ok(audit.some((record) => record.type === "delivery.acked" && record.messageId === accepted.message.id));
});
