import assert from "node:assert/strict";
import { test } from "node:test";
import { runPlayground, validatePlayground } from "../lib/demo-playground.mjs";

const base = {
  subject: "my.message", sender: "my-app", allowedSender: "my-app", region: "uk",
  allowedRegion: "uk", forbiddenField: "password", requiredField: "message",
  payload: { message: "Hello" }
};

test("delivers the original Unicode payload and records actual broker evidence", () => {
  const payload = { message: "你好 👋 ".repeat(48) };
  const run = runPlayground({ ...base, payload });
  assert.equal(run.decision, "ALLOW");
  assert.equal(run.receiver.receivedCount, 1);
  assert.deepEqual(run.receiver.delivered[0].data, payload);
  assert.ok(run.contract);
  assert.ok(run.audit.some((entry) => entry.type === "publish.accepted"));
  assert.ok(run.audit.some((entry) => entry.type === "delivery.dispatched"));
});

test("observes empty inboxes and distinguishes contract refusal from quarantine", () => {
  for (const [patch, code, decision] of [
    [{ sender: "unknown-service" }, "NO_PERMITTED_SUBJECTS", "DENY"],
    [{ region: "us" }, "REGION_DENIED", "QUARANTINE"],
    [{ payload: { message: "hello", password: "not-a-real-secret" } }, "SENSITIVE_FIELD_DENIED", "QUARANTINE"],
    [{ payload: { other: "hello" } }, "SCHEMA_INVALID", "QUARANTINE"],
    [{ forbiddenField: "card.pan", payload: { message: "hello", card: { pan: "sample" } } }, "SENSITIVE_FIELD_DENIED", "QUARANTINE"]
  ]) {
    const run = runPlayground({ ...base, ...patch });
    assert.equal(run.code, code);
    assert.equal(run.decision, decision);
    assert.equal(run.receiver.receivedCount, 0);
    assert.equal(run.quarantineCount, decision === "QUARANTINE" ? 1 : 0);
    assert.ok(!run.audit.some((entry) => entry.type === "delivery.dispatched"));
  }
});

test("changed rules take effect and broker state is isolated between runs", () => {
  const a = runPlayground(base);
  const b = runPlayground({ ...base, sender: "worker", allowedSender: "worker", region: "us", allowedRegion: "any", forbiddenField: "", requiredField: "", payload: { password: "sample" } });
  assert.notEqual(a.runId, b.runId);
  assert.equal(b.decision, "ALLOW");
  assert.equal(b.receiver.receivedCount, 1);
  assert.deepEqual(b.receiver.delivered[0].data, { password: "sample" });
  assert.notEqual(a.receiver.delivered[0].id, b.receiver.delivered[0].id);
  assert.equal(a.receiver.receivedCount, 1);
});

test("rejects malformed inputs and unsafe field paths before execution", () => {
  for (const input of [null, [], {}, { ...base, payload: [] }, { ...base, forbiddenField: "__proto__.polluted" }, { ...base, requiredField: "constructor" }, { ...base, region: "unknown" }, { ...base, payload: { message: "x".repeat(4097) } }]) {
    assert.equal(typeof validatePlayground(input), "string");
    assert.throws(() => runPlayground(input), { code: "BAD_REQUEST" });
  }
});
