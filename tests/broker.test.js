import assert from "node:assert/strict";
import test from "node:test";
import { PigeonBroker, PigeonError } from "../src/index.js";
import { createPaymentBroker, createDemoBroker } from "../src/subjects.js";

const ordersApi = {
  principal: { id: "spiffe://merchant-prod/ns/orders/sa/orders-api" },
  region: "uk"
};

const notifyReplay = {
  principal: { id: "spiffe://merchant-prod/ns/ops/sa/notify-replay" },
  region: "uk"
};

function notification(overrides = {}) {
  return {
    recipientId: "cust_42",
    channel: "email",
    templateId: "order_shipped",
    ...overrides
  };
}

function notifyOptions(overrides = {}) {
  return {
    intent: "send_notification",
    idempotencyKey: "cust_42:shipped",
    classification: "pii",
    region: "uk",
    ...overrides
  };
}

const checkout = {
  principal: { id: "spiffe://merchant-prod/ns/checkout/sa/checkout-api" },
  region: "uk"
};

const gateway = {
  principal: { id: "spiffe://merchant-prod/ns/payments/sa/gateway-adapter" },
  region: "uk"
};

const catalog = {
  principal: { id: "spiffe://merchant-prod/ns/catalog/sa/catalog-api" },
  region: "uk"
};

function payment(overrides = {}) {
  return {
    merchantId: "merchant_123",
    orderId: "order_456",
    amount: 42.5,
    currency: "GBP",
    paymentToken: "tok_visa_abc",
    ...overrides
  };
}

function requestOptions(overrides = {}) {
  return {
    intent: "authorize_payment",
    idempotencyKey: "order_456:authorize",
    classification: "pci",
    region: "uk",
    ...overrides
  };
}

test("accepts a governed payment authorization", () => {
  const broker = createPaymentBroker(PigeonBroker);
  const result = broker.request("payments.authorize", payment(), checkout, requestOptions());

  assert.equal(result.status, "accepted");
  assert.equal(result.message.intent, "authorize_payment");
  assert.equal(result.message.sequence, 1);
});

test("deduplicates retries with the same idempotency key", () => {
  const broker = createPaymentBroker(PigeonBroker);
  const first = broker.request("payments.authorize", payment(), checkout, requestOptions());
  const retry = broker.request("payments.authorize", payment(), checkout, requestOptions());

  assert.equal(first.status, "accepted");
  assert.equal(retry.status, "duplicate");
  assert.equal(retry.message.id, first.message.id);
  assert.equal(broker.receive("payments.authorize", gateway, { max: 10 }).length, 1);
});

test("denies unauthorized producers", () => {
  const broker = createPaymentBroker(PigeonBroker);

  assert.throws(
    () => broker.request("payments.authorize", payment(), catalog, requestOptions()),
    (error) => error instanceof PigeonError && error.code === "POLICY_DENIED"
  );
});

test("requires idempotency keys for payment authorization", () => {
  const broker = createPaymentBroker(PigeonBroker);

  assert.throws(
    () => broker.request("payments.authorize", payment(), checkout, requestOptions({ idempotencyKey: undefined })),
    (error) => error instanceof PigeonError && error.code === "IDEMPOTENCY_REQUIRED"
  );
});

test("denies messages containing forbidden sensitive fields and quarantines them", () => {
  const broker = createPaymentBroker(PigeonBroker);

  assert.throws(
    () => broker.request("payments.authorize", payment({ card: { pan: "4111111111111111" } }), checkout, requestOptions()),
    (error) => error instanceof PigeonError && error.code === "SENSITIVE_FIELD_DENIED"
  );

  const quarantine = broker.listQuarantine();
  assert.equal(quarantine.length, 1);
  assert.equal(quarantine[0].code, "SENSITIVE_FIELD_DENIED");
});

test("denies messages from disallowed regions", () => {
  const broker = createPaymentBroker(PigeonBroker);

  assert.throws(
    () => broker.request("payments.authorize", payment(), checkout, requestOptions({ region: "us" })),
    (error) => error instanceof PigeonError && error.code === "POLICY_DENIED"
  );
});

test("denies replay when subject replay is disabled", () => {
  const broker = createPaymentBroker(PigeonBroker);
  broker.request("payments.authorize", payment(), checkout, requestOptions());

  assert.throws(
    () => broker.replay("payments.authorize", gateway, { reason: "debugging" }),
    (error) => error instanceof PigeonError && error.code === "REPLAY_DENIED"
  );
});

test("records audit events for accepted and denied publishes", () => {
  const broker = createPaymentBroker(PigeonBroker);
  broker.request("payments.authorize", payment(), checkout, requestOptions());

  assert.throws(
    () => broker.request("payments.authorize", payment({ orderId: "order_789" }), catalog, requestOptions({ idempotencyKey: "order_789:authorize" })),
    PigeonError
  );

  const auditTypes = broker.listAudit().map((record) => record.type);
  assert.ok(auditTypes.includes("publish.accepted"));
  assert.ok(auditTypes.includes("publish.denied"));
});

test("rejects an envelope missing required fields", () => {
  const broker = createPaymentBroker(PigeonBroker);

  assert.throws(
    () => broker.publish({ subject: "payments.authorize" }, checkout),
    (error) => error instanceof PigeonError && error.code === "ENVELOPE_INVALID"
  );
});

test("denies a classification mismatch", () => {
  const broker = createPaymentBroker(PigeonBroker);

  assert.throws(
    () => broker.request("payments.authorize", payment(), checkout, requestOptions({ classification: "internal" })),
    (error) => error instanceof PigeonError && error.code === "CLASSIFICATION_DENIED"
  );
});

test("quarantines schema-invalid payloads", () => {
  const broker = createPaymentBroker(PigeonBroker);

  assert.throws(
    () => broker.request("payments.authorize", payment({ amount: "not-a-number" }), checkout, requestOptions({ idempotencyKey: "bad_schema:authorize" })),
    (error) => error instanceof PigeonError && error.code === "SCHEMA_INVALID"
  );

  assert.equal(broker.listQuarantine().some((record) => record.code === "SCHEMA_INVALID"), true);
});

test("records an ack for a delivered message", () => {
  const broker = createPaymentBroker(PigeonBroker);
  const { message } = broker.request("payments.authorize", payment(), checkout, requestOptions());
  broker.receive("payments.authorize", gateway, { max: 10 });

  const acked = broker.ack("payments.authorize", message.id, gateway);
  assert.equal(acked.ackedBy[0].principal, gateway.principal.id);
  assert.ok(broker.listAudit().some((record) => record.type === "delivery.acked"));
});

test("lists every registered subject", () => {
  const broker = createDemoBroker(PigeonBroker);
  const names = broker.listSubjects().map((subject) => subject.name);
  assert.deepEqual(names.sort(), ["notifications.send", "payments.authorize"]);
});

test("allows governed replay on the notifications subject", () => {
  const broker = createDemoBroker(PigeonBroker);
  broker.request("notifications.send", notification(), ordersApi, notifyOptions());

  const replayed = broker.replay("notifications.send", notifyReplay, { reason: "resend after outage" });
  assert.equal(replayed.length, 1);
  assert.ok(broker.listAudit().some((record) => record.type === "replay.executed"));
});

test("denies replay when no reason is supplied", () => {
  const broker = createDemoBroker(PigeonBroker);
  broker.request("notifications.send", notification(), ordersApi, notifyOptions());

  assert.throws(
    () => broker.replay("notifications.send", notifyReplay, {}),
    (error) => error instanceof PigeonError && error.code === "POLICY_DENIED"
  );
});

test("forbids raw SSN on the notifications subject", () => {
  const broker = createDemoBroker(PigeonBroker);

  assert.throws(
    () => broker.request("notifications.send", notification({ recipient: { ssn: "078-05-1120" } }), ordersApi, notifyOptions({ idempotencyKey: "leak:1" })),
    (error) => error instanceof PigeonError && error.code === "SENSITIVE_FIELD_DENIED"
  );
});
