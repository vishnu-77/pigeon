import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PigeonBroker } from "../src/index.js";
import { createDemoBroker } from "../src/subjects.js";
import { createPigeonServer } from "../src/server.js";

let server;
let base;

const CHECKOUT_TOKEN = "checkout-token";
const GATEWAY_TOKEN = "gateway-token";
const CATALOG_TOKEN = "catalog-token";

before(async () => {
  server = createPigeonServer(createDemoBroker(PigeonBroker));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
});

function auth(token, extra = {}) {
  return { "content-type": "application/json", authorization: `Bearer ${token}`, "x-pigeon-region": "uk", ...extra };
}

async function negotiate(token, subjects) {
  const response = await fetch(`${base}/v1/contracts`, {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ subjects })
  });
  return response;
}

async function contractId(token, subjects) {
  const response = await negotiate(token, subjects);
  return (await response.json()).contract.id;
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

async function publish(token, cid, body) {
  return fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: auth(token, { "x-pigeon-contract": cid }),
    body: JSON.stringify(body)
  });
}

test("serves the Acme Checkout dashboard at /", async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /ACME CHECKOUT/);
});

test("serves the API docs at /docs", async () => {
  const response = await fetch(`${base}/docs`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /\/v1\/messages/);
});

test("health check responds ok", async () => {
  const response = await fetch(`${base}/health`);
  assert.deepEqual(await response.json(), { ok: true, service: "pigeon" });
});

test("lists registered subjects", async () => {
  const { subjects } = await (await fetch(`${base}/v1/subjects`)).json();
  const names = subjects.map((s) => s.name);
  assert.ok(names.includes("payments.authorize") && names.includes("notifications.send"));
});

test("negotiates a session contract", async () => {
  const response = await negotiate(CHECKOUT_TOKEN, ["payments.authorize"]);
  assert.equal(response.status, 201);
  const { contract } = await response.json();
  assert.equal(contract.principal, "spiffe://merchant-prod/ns/checkout/sa/checkout-api");
  assert.ok(contract.subjects[0].operations.includes("publish"));
});

test("rejects negotiation without a credential (401)", async () => {
  const response = await fetch(`${base}/v1/contracts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subjects: ["payments.authorize"] })
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
});

test("rejects an unknown credential (401)", async () => {
  const response = await negotiate("not-a-real-token", ["payments.authorize"]);
  assert.equal(response.status, 401);
});

test("accepts a governed publish under a contract with 202", async () => {
  const cid = await contractId(CHECKOUT_TOKEN, ["payments.authorize"]);
  const response = await publish(CHECKOUT_TOKEN, cid, authorizePayment({ idempotencyKey: "http_accept:authorize" }));
  assert.equal(response.status, 202);
  assert.equal((await response.json()).status, "accepted");
});

test("denies a publish with no contract (403)", async () => {
  const response = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: auth(CHECKOUT_TOKEN),
    body: JSON.stringify(authorizePayment({ idempotencyKey: "http_nocontract:authorize" }))
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "CONTRACT_REQUIRED");
});

test("blocks producer spoofing: gateway cannot use checkout's contract (403)", async () => {
  const checkoutCid = await contractId(CHECKOUT_TOKEN, ["payments.authorize"]);
  const response = await publish(GATEWAY_TOKEN, checkoutCid, authorizePayment({ idempotencyKey: "http_spoof:authorize" }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "CONTRACT_PRINCIPAL_MISMATCH");
});

test("denies an unauthorized producer at negotiation (403)", async () => {
  const response = await negotiate(CATALOG_TOKEN, ["payments.authorize"]);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "NO_PERMITTED_SUBJECTS");
});

test("returns 200 for a duplicate idempotency key", async () => {
  const cid = await contractId(CHECKOUT_TOKEN, ["payments.authorize"]);
  await publish(CHECKOUT_TOKEN, cid, authorizePayment({ idempotencyKey: "http_dup:authorize" }));
  const response = await publish(CHECKOUT_TOKEN, cid, authorizePayment({ idempotencyKey: "http_dup:authorize" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "duplicate");
});

test("rejects a malformed JSON body with 400", async () => {
  const cid = await contractId(CHECKOUT_TOKEN, ["payments.authorize"]);
  const response = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: auth(CHECKOUT_TOKEN, { "x-pigeon-contract": cid }),
    body: "{not json"
  });
  assert.equal(response.status, 400);
});

test("rejects an oversized body with 413", async () => {
  const response = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: auth(CHECKOUT_TOKEN),
    body: JSON.stringify({ subject: "payments.authorize", data: { blob: "x".repeat(1_100_000) } })
  });
  assert.equal(response.status, 413);
});

test("rejects an incomplete envelope with 422", async () => {
  const cid = await contractId(CHECKOUT_TOKEN, ["payments.authorize"]);
  const response = await publish(CHECKOUT_TOKEN, cid, { subject: "payments.authorize" });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "ENVELOPE_INVALID");
});

test("returns 404 for an unknown subject", async () => {
  const response = await negotiate(CHECKOUT_TOKEN, ["ghost.subject"]);
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
  const checkoutCid = await contractId(CHECKOUT_TOKEN, ["payments.authorize"]);
  await publish(CHECKOUT_TOKEN, checkoutCid, authorizePayment({ idempotencyKey: "http_recv:authorize" }));

  const gatewayCid = await contractId(GATEWAY_TOKEN, ["payments.authorize"]);
  const response = await fetch(`${base}/v1/subjects/payments.authorize/receive`, {
    method: "POST",
    headers: auth(GATEWAY_TOKEN, { "x-pigeon-contract": gatewayCid }),
    body: JSON.stringify({ max: 50 })
  });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).messages.length >= 1);
});
