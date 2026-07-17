import assert from "node:assert/strict";
import test from "node:test";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditLog, FileStore, PigeonBroker, PigeonError } from "../src/index.js";
import { paymentAuthorizationSchema, paymentsAuthorizeSubject } from "../src/subjects.js";

function tempDir() {
  return mkdtempSync(join(tmpdir(), "pigeon-"));
}

test("FileStore recovers messages, cursors, and quarantine after restart", () => {
  const dir = tempDir();
  const path = join(dir, "store.log");
  try {
    const store = new FileStore({ path });
    store.initSubject("s");
    store.appendMessage("s", { id: "a", data: 1 });
    store.appendMessage("s", { id: "b", data: 2 });
    store.setCursor("s:consumer", 1);
    store.setIdempotent("s", "key-1", { id: "a" });
    store.addQuarantine({ subject: "s", code: "SCHEMA_INVALID", reason: "bad" });

    // Simulate a restart: a brand-new store over the same log file.
    const recovered = new FileStore({ path });
    assert.equal(recovered.listMessages("s").length, 2);
    assert.equal(recovered.findMessage("s", "b").data, 2);
    assert.equal(recovered.getCursor("s:consumer"), 1);
    assert.equal(recovered.getIdempotent("s", "key-1")?.id, "a");
    assert.equal(recovered.listQuarantine().length, 1);
    assert.equal(recovered.appendMessage("s", { id: "c" }).sequence, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a broker on a FileStore keeps its message log across restarts", () => {
  const dir = tempDir();
  const path = join(dir, "broker.log");
  try {
    const first = new PigeonBroker({ store: new FileStore({ path }) });
    first.registerSchema("payment.authorization.v1", paymentAuthorizationSchema);
    first.registerSubject(paymentsAuthorizeSubject);
    first.registerToken("checkout-token", { id: "spiffe://merchant-prod/ns/checkout/sa/checkout-api" });
    const session = first.connect(
      { principal: { id: "spiffe://merchant-prod/ns/checkout/sa/checkout-api" }, region: "uk" },
      { subjects: ["payments.authorize"] }
    );
    session.request("payments.authorize", { merchantId: "m", orderId: "o", amount: 1, currency: "GBP", paymentToken: "t" }, {
      intent: "authorize_payment", idempotencyKey: "k:1", classification: "pci", region: "uk"
    });

    const second = new PigeonBroker({ store: new FileStore({ path }) });
    second.registerSubject(paymentsAuthorizeSubject);
    assert.equal(second.store.listMessages("payments.authorize").length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AuditLog persists records and verifies its hash chain after restart", () => {
  const dir = tempDir();
  const path = join(dir, "audit.log");
  try {
    const log = new AuditLog({ path });
    log.write("publish.accepted", { subject: "s", decision: "allow" });
    log.write("publish.denied", { subject: "s", decision: "deny" });
    assert.equal(log.verify(), true);

    const recovered = new AuditLog({ path });
    assert.equal(recovered.all().length, 2);
    assert.equal(recovered.verify(), true);

    // Tampering breaks the chain.
    recovered.records[0].decision = "deny";
    assert.equal(recovered.verify(), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("FileStore tolerates a torn trailing line but fails closed on mid-file corruption", () => {
  const dir = tempDir();
  const path = join(dir, "store.log");
  try {
    const store = new FileStore({ path });
    store.initSubject("s");
    store.appendMessage("s", { id: "a", data: 1 });
    store.appendMessage("s", { id: "b", data: 2 });

    // A torn trailing line (as if the process crashed mid-append) is tolerated.
    appendFileSync(path, '{"op":"appendMessage","subject":"s","message":{"id":"c"');
    const recovered = new FileStore({ path });
    assert.equal(recovered.listMessages("s").length, 2);

    // A corrupt line in the *middle* of the log must not be silently swallowed.
    const lines = readFileSync(path, "utf8").split("\n").filter((line) => line.trim() !== "");
    lines[0] = "{not valid json";
    writeFileSync(path, `${lines.join("\n")}\n`);
    assert.throws(
      () => new FileStore({ path }),
      (error) => error instanceof PigeonError && error.code === "STORE_CORRUPT"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AuditLog tolerates a torn trailing line but fails closed on mid-file corruption or a broken hash chain", () => {
  const dir = tempDir();
  const path = join(dir, "audit.log");
  try {
    const log = new AuditLog({ path });
    log.write("publish.accepted", { subject: "s", decision: "allow" });
    log.write("publish.denied", { subject: "s", decision: "deny" });

    appendFileSync(path, '{"id":"audit_3","type":"publish.accep');
    const recovered = new AuditLog({ path });
    assert.equal(recovered.all().length, 2);

    const lines = readFileSync(path, "utf8").split("\n").filter((line) => line.trim() !== "");
    lines[0] = "{not valid json";
    writeFileSync(path, `${lines.join("\n")}\n`);
    assert.throws(
      () => new AuditLog({ path }),
      (error) => error instanceof PigeonError && error.code === "AUDIT_LOG_CORRUPT"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AuditLog fails closed if the on-disk hash chain has been tampered with", () => {
  const dir = tempDir();
  const path = join(dir, "audit.log");
  try {
    const log = new AuditLog({ path });
    log.write("publish.accepted", { subject: "s", decision: "allow" });
    log.write("publish.denied", { subject: "s", decision: "deny" });

    const lines = readFileSync(path, "utf8").split("\n").filter((line) => line.trim() !== "");
    const tampered = JSON.parse(lines[0]);
    tampered.decision = "allow-but-tampered";
    lines[0] = JSON.stringify(tampered);
    writeFileSync(path, `${lines.join("\n")}\n`);

    assert.throws(
      () => new AuditLog({ path }),
      (error) => error instanceof PigeonError && error.code === "AUDIT_LOG_TAMPERED"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
