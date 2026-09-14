import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { PigeonBroker } from "../src/broker.js";
import { createDemoBroker } from "../src/subjects.js";
import { createPigeonServer } from "../src/server.js";

async function setup(t) {
  const broker = createDemoBroker(PigeonBroker);
  const server = createPigeonServer(broker);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  function run(role, env = {}) {
    const child = spawn(process.execPath, [fileURLToPath(new URL(`../examples/container-${role}.js`, import.meta.url))], {
      windowsHide: true,
      env: { ...process.env, PIGEON_URL: url, PIGEON_TOKEN: role === "sender" ? "checkout-token" : "gateway-token",
        DEMO_RUN_ID: "", DEMO_TIMEOUT_MS: "5000", SENDER_HOLD_OPEN: "false", ...env }
    });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { output += data; });
    const timer = setTimeout(() => child.kill(), 10_000);
    return new Promise((resolve, reject) => {
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("close", (code) => { clearTimeout(timer); resolve({ code, output }); });
    });
  }
  return { broker, run };
}

test("separate sender/receiver processes verify the flow in either startup order and on repeat runs", async (t) => {
  const { broker, run } = await setup(t);
  for (const [index, first] of ["receiver", "sender"].entries()) {
    const env = { DEMO_RUN_ID: `integration-${index}` };
    const one = run(first, env);
    await delay(150);
    const two = run(first === "sender" ? "receiver" : "sender", env);
    for (const result of await Promise.all([one, two])) {
      assert.equal(result.code, 0, result.output);
      assert.match(result.output, /complete:/);
    }
  }
  const messages = broker.store.listMessages("payments.authorize");
  assert.equal(messages.length, 2);
  assert.ok(messages.every((m) => m.deliveries.length === 1 && m.ackedBy.length === 1));
  assert.equal(broker.listQuarantine().length, 2);
  assert.ok(broker.listQuarantine().every((r) => r.message.data.card.pan === "[REDACTED]"));
});

test("sender fails when the receiver is absent and rejects an unexpected denial response", async (t) => {
  const { broker, run } = await setup(t);
  const missing = await run("sender", { DEMO_RUN_ID: "missing", DEMO_TIMEOUT_MS: "300" });
  assert.notEqual(missing.code, 0);
  assert.match(missing.output, /waiting for receiver acknowledgement/);
  const publish = broker.publish.bind(broker);
  broker.publish = (message, context) => {
    if (message.data.card) throw new Error("unexpected server failure");
    return publish(message, context);
  };
  const wrongDenial = await run("sender", { DEMO_RUN_ID: "wrong-denial" });
  assert.notEqual(wrongDenial.code, 0);
  assert.doesNotMatch(wrongDenial.output, /raw PAN denied: SENSITIVE_FIELD_DENIED/);
});

test("receiver fails with no messages and invalid credentials fail at negotiation", async (t) => {
  const { run } = await setup(t);
  const empty = await run("receiver", { DEMO_TIMEOUT_MS: "300" });
  assert.notEqual(empty.code, 0);
  assert.match(empty.output, /waiting for payment messages/);
  const invalid = await run("sender", { PIGEON_TOKEN: "invalid" });
  assert.notEqual(invalid.code, 0);
  assert.match(invalid.output, /UNAUTHENTICATED/);
});

test("receiver does not acknowledge or report success without this order's governance evidence", async (t) => {
  const { broker, run } = await setup(t);
  const sender = broker.connect({ principal: broker.authenticate("Bearer checkout-token"), region: "uk" });
  const { message } = sender.request("payments.authorize", {
    merchantId: "merchant_container", orderId: "order_container_incomplete", amount: 1,
    currency: "GBP", paymentToken: "tok"
  }, { intent: "authorize_payment", idempotencyKey: "order_container_incomplete:authorize", classification: "pci", region: "uk" });
  const result = await run("receiver", { DEMO_RUN_ID: "incomplete", DEMO_TIMEOUT_MS: "300" });
  assert.notEqual(result.code, 0);
  assert.match(result.output, /waiting for acceptance, duplicate and quarantine evidence/);
  assert.equal(message.ackedBy, undefined);
});
