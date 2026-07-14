import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCatalog, lintCatalog, applyCatalog, PigeonBroker } from "../src/index.js";

const policiesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "policies");

test("loads the shipped policy catalog and lints clean", () => {
  const catalog = loadCatalog(policiesDir);
  assert.equal(catalog.subjects.length, 2);
  assert.equal(Object.keys(catalog.schemas).length, 2);
  const { errors, warnings } = lintCatalog(catalog);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("lint flags a malformed catalog", () => {
  const bad = {
    schemas: {},
    subjects: [
      { name: "broken", intents: [], schema: { name: "missing.schema" }, policy: { publish: [{ effect: "maybe" }] } }
    ]
  };
  const { errors, warnings } = lintCatalog(bad);
  assert.ok(errors.some((e) => e.includes("non-empty array")));
  assert.ok(errors.some((e) => e.includes("unknown schema")));
  assert.ok(errors.some((e) => e.includes("invalid effect")));
  assert.ok(warnings.some((w) => w.includes("nothing can be sent")));
});

test("applyCatalog registers file-defined subjects on a broker", () => {
  const broker = new PigeonBroker();
  applyCatalog(broker, loadCatalog(policiesDir));
  const names = broker.listSubjects().map((s) => s.name).sort();
  assert.deepEqual(names, ["notifications.send", "payments.authorize"]);
});

test("applyCatalog refuses an invalid catalog", () => {
  const broker = new PigeonBroker();
  assert.throws(
    () => applyCatalog(broker, { schemas: {}, subjects: [{ intents: [] }] }),
    (error) => error.code === "POLICY_INVALID"
  );
});
