import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PigeonBroker } from "../src/index.js";
import { createDemoBroker } from "../src/subjects.js";
import { createPigeonServer } from "../src/server.js";

let server;
let base;

const CHECKOUT = "spiffe://merchant-prod/ns/checkout/sa/checkout-api";
const GATEWAY = "spiffe://merchant-prod/ns/payments/sa/gateway-adapter";
const CATALOG = "spiffe://merchant-prod/ns/catalog/sa/catalog-api";

before(async () => {
  server = createPigeonServer(createDemoBroker(PigeonBroker));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
});

function publish(principal, body) {
  return fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pigeon-principal": principal, "x-pigeon-region": "uk" },
    body: JSON.stringify(body)
  });
}

function authorizePayment(overrides = {}) {
  return {
    subject: "payments.authorize",
    type: "payment.authorization.requested",
    source: "checkout-service",
    intent: "authorize_payment",
    idempotencyKey: "http_1:authorize",
    classification: "pci",
    region: "uk",
    data: { merchantId: "m", orderId: "o", amount: 10, currency: "GBP", paymentToken: "tok" },
    ...overrides
  };
}

test("serves the Acme Checkout dashboard at /", async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(await response.text(), /ACME CHECKOUT/);
});

test("serves the API docs at /docs", async () => {
  const response = await fetch(`${base}/docs`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(await response.text(), /\/v1\/messages/);
});

test("health check responds ok", async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "pigeon" });
});

test("lists registered subjects", async () => {
  const response = await fetch(`${base}/v1/subjects`);
  assert.equal(response.status, 200);
  const { subjects } = await response.json();
  const names = subjects.map((s) => s.name);
  assert.ok(names.includes("payments.authorize"));
  assert.ok(names.includes("notifications.send"));
});

test("describes a single subject", async () => {
  const response = await fetch(`${base}/v1/subjects/payments.authorize`);
  assert.equal(response.status, 200);
  const { subject } = await response.json();
  assert.equal(subject.name, "payments.authorize");
  assert.equal(subject.replay.allowed, false);
});

test("accepts a governed publish with 202", async () => {
  const response = await publish(CHECKOUT, authorizePayment({ idempotencyKey: "http_accept:authorize" }));
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.status, "accepted");
});

test("returns 200 for a duplicate idempotency key", async () => {
  await publish(CHECKOUT, authorizePayment({ idempotencyKey: "http_dup:authorize" }));
  const response = await publish(CHECKOUT, authorizePayment({ idempotencyKey: "http_dup:authorize" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "duplicate");
});

test("denies an unauthorized producer with 403", async () => {
  const response = await publish(CATALOG, authorizePayment({ idempotencyKey: "http_deny:authorize" }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "POLICY_DENIED");
});

test("rejects a malformed JSON body with 400", async () => {
  const response = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pigeon-principal": CHECKOUT },
    body: "{not json"
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "BAD_REQUEST");
});

test("rejects an oversized body with 413", async () => {
  const response = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pigeon-principal": CHECKOUT },
    body: JSON.stringify({ subject: "payments.authorize", data: { blob: "x".repeat(1_100_000) } })
  });
  assert.equal(response.status, 413);
});

test("rejects an incomplete envelope with 422", async () => {
  const response = await publish(CHECKOUT, { subject: "payments.authorize" });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "ENVELOPE_INVALID");
});

test("returns 404 for an unknown subject", async () => {
  const response = await publish(CHECKOUT, authorizePayment({ subject: "ghost.subject", idempotencyKey: "http_ghost" }));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "SUBJECT_NOT_FOUND");
});

test("returns 405 for a known path with the wrong method", async () => {
  const response = await fetch(`${base}/v1/messages`);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("returns 404 for an unknown route", async () => {
  const response = await fetch(`${base}/nope`);
  assert.equal(response.status, 404);
});

test("delivers only authorized messages to the receiver", async () => {
  await publish(CHECKOUT, authorizePayment({ idempotencyKey: "http_recv:authorize", data: { merchantId: "m", orderId: "recv", amount: 5, currency: "GBP", paymentToken: "tok" } }));
  const response = await fetch(`${base}/v1/subjects/payments.authorize/receive`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pigeon-principal": GATEWAY, "x-pigeon-region": "uk" },
    body: JSON.stringify({ max: 50 })
  });
  assert.equal(response.status, 200);
  const { messages } = await response.json();
  assert.ok(messages.length >= 1);
});
