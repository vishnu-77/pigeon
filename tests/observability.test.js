import assert from "node:assert/strict";
import test from "node:test";
import { createObservability } from "../src/observability.js";

test("creates broker observability", () => {
  const observability = createObservability();

  assert.equal(typeof observability.startSpan, "function");
  assert.equal(typeof observability.recordDecision, "function");
  assert.equal(typeof observability.recordGateLatency, "function");
});