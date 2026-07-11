import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore, PigeonError } from "../src/index.js";

test("assigns monotonic sequence numbers on append", () => {
  const store = new MemoryStore();
  store.initSubject("s");
  const first = store.appendMessage("s", { id: "a" });
  const second = store.appendMessage("s", { id: "b" });

  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.equal(store.listMessages("s").length, 2);
});

test("finds messages by id and returns undefined for misses", () => {
  const store = new MemoryStore();
  store.initSubject("s");
  store.appendMessage("s", { id: "a" });

  assert.equal(store.findMessage("s", "a").id, "a");
  assert.equal(store.findMessage("s", "missing"), undefined);
});

test("throws for operations on unregistered subjects", () => {
  const store = new MemoryStore();
  assert.throws(
    () => store.listMessages("ghost"),
    (error) => error instanceof PigeonError && error.code === "SUBJECT_NOT_FOUND"
  );
});

test("tracks per-consumer cursors independently", () => {
  const store = new MemoryStore();
  assert.equal(store.getCursor("k"), 0);
  store.setCursor("k", 3);
  assert.equal(store.getCursor("k"), 3);
  assert.equal(store.getCursor("other"), 0);
});

test("stores and retrieves idempotency records per subject", () => {
  const store = new MemoryStore();
  assert.equal(store.getIdempotent("s", "key"), null);
  store.setIdempotent("s", "key", { id: "a" });
  assert.equal(store.getIdempotent("s", "key").id, "a");
});

test("assigns ids to quarantine records", () => {
  const store = new MemoryStore();
  const record = store.addQuarantine({ subject: "s", code: "SCHEMA_INVALID" });
  assert.equal(record.id, "quarantine_1");
  assert.equal(store.listQuarantine().length, 1);
});
