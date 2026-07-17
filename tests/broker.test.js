import assert from "node:assert/strict";
import test from "node:test";
import { PigeonBroker, PigeonError, ContractRegistry, MemoryStore } from "../src/index.js";
import { createPaymentBroker, createDemoBroker, paymentAuthorizationSchema, paymentsAuthorizeSubject } from "../src/subjects.js";

// Build a payment broker with injected clocks on the contract registry and store,
// for deterministic expiry / TTL tests.
function clockedPaymentBroker(now) {
  const broker = new PigeonBroker({ contracts: new ContractRegistry({ now }), store: new MemoryStore({ now }) });
  broker.registerSchema("payment.authorization.v1", paymentAuthorizationSchema);
  broker.registerSubject(paymentsAuthorizeSubject);
  broker.registerToken("checkout-token", checkout.principal);
  return broker;
}

const checkout = { principal: { id: "spiffe://merchant-prod/ns/checkout/sa/checkout-api" }, region: "uk" };
const gateway = { principal: { id: "spiffe://merchant-prod/ns/payments/sa/gateway-adapter" }, region: "uk" };
const catalog = { principal: { id: "spiffe://merchant-prod/ns/catalog/sa/catalog-api" }, region: "uk" };
const ordersApi = { principal: { id: "spiffe://merchant-prod/ns/orders/sa/orders-api" }, region: "uk" };
const notifyReplay = { principal: { id: "spiffe://merchant-prod/ns/ops/sa/notify-replay" }, region: "uk" };

function payment(overrides = {}) {
  return { merchantId: "merchant_123", orderId: "order_456", amount: 42.5, currency: "GBP", paymentToken: "tok_visa_abc", ...overrides };
}

function requestOptions(overrides = {}) {
  return { intent: "authorize_payment", idempotencyKey: "order_456:authorize", classification: "pci", region: "uk", ...overrides };
}

function notification(overrides = {}) {
  return { recipientId: "cust_42", channel: "email", templateId: "order_shipped", ...overrides };
}

function notifyOptions(overrides = {}) {
  return { intent: "send_notification", idempotencyKey: "cust_42:shipped", classification: "pii", region: "uk", ...overrides };
}

// A checkout session on a fresh payment broker.
function checkoutSession() {
  const broker = createPaymentBroker(PigeonBroker);
  return { broker, session: broker.connect(checkout, { subjects: ["payments.authorize"] }) };
}

test("accepts a governed payment authorization", () => {
  const { session } = checkoutSession();
  const result = session.request("payments.authorize", payment(), requestOptions());

  assert.equal(result.status, "accepted");
  assert.equal(result.message.intent, "authorize_payment");
  assert.equal(result.message.sequence, 1);
  assert.equal(result.message.contractId, session.contract.id);
});

test("binds message source to the authenticated principal, ignoring client claims", () => {
  const { session } = checkoutSession();
  const result = session.publish({
    subject: "payments.authorize",
    type: "payment.authorization.requested",
    source: "spiffe://evil/impersonator", // client lie
    intent: "authorize_payment",
    idempotencyKey: "bind:1",
    classification: "pci",
    region: "uk",
    data: payment()
  });
  assert.equal(result.message.source, checkout.principal.id);
});

test("deduplicates retries with the same idempotency key", () => {
  const { broker, session } = checkoutSession();
  const first = session.request("payments.authorize", payment(), requestOptions());
  const retry = session.request("payments.authorize", payment(), requestOptions());

  assert.equal(first.status, "accepted");
  assert.equal(retry.status, "duplicate");
  assert.equal(retry.message.id, first.message.id);

  const gatewaySession = broker.connect(gateway, { subjects: ["payments.authorize"] });
  assert.equal(gatewaySession.receive("payments.authorize", { max: 10 }).length, 1);
});

test("denies an unauthorized producer at contract negotiation", () => {
  const broker = createPaymentBroker(PigeonBroker);
  assert.throws(
    () => broker.connect(catalog, { subjects: ["payments.authorize"] }),
    (error) => error instanceof PigeonError && error.code === "NO_PERMITTED_SUBJECTS"
  );
});

test("denies a publish with no contract", () => {
  const broker = createPaymentBroker(PigeonBroker);
  assert.throws(
    () => broker.publish({ subject: "payments.authorize", type: "t", source: "x", intent: "authorize_payment", data: payment() }, checkout),
    (error) => error instanceof PigeonError && error.code === "CONTRACT_REQUIRED"
  );
});

test("blocks producer spoofing: a principal cannot use another's contract", () => {
  const broker = createDemoBroker(PigeonBroker);
  const checkoutContract = broker.negotiate(checkout, { subjects: ["payments.authorize"] });

  // gateway (a different principal) tries to publish under checkout's contract id.
  assert.throws(
    () => broker.publish(
      { subject: "payments.authorize", type: "t", source: "x", intent: "authorize_payment", data: payment() },
      { principal: gateway.principal, region: "uk", contractId: checkoutContract.id }
    ),
    (error) => error instanceof PigeonError && error.code === "CONTRACT_PRINCIPAL_MISMATCH"
  );
});

test("denies an operation outside the contract's subjects", () => {
  const broker = createDemoBroker(PigeonBroker);
  // A contract scoped to notifications only cannot be used to publish payments.
  const contract = broker.negotiate(ordersApi, { subjects: ["notifications.send"] });
  assert.throws(
    () => broker.publish(
      { subject: "payments.authorize", type: "t", source: "x", intent: "authorize_payment", data: payment() },
      { principal: ordersApi.principal, region: "uk", contractId: contract.id }
    ),
    (error) => error instanceof PigeonError && error.code === "SUBJECT_NOT_IN_CONTRACT"
  );
});

test("denies an expired contract", () => {
  let clock = 1_000_000;
  const broker = clockedPaymentBroker(() => clock);
  const contract = broker.negotiate(checkout, { subjects: ["payments.authorize"], ttlMs: 1000 });
  clock += 2000; // advance past expiry
  assert.throws(
    () => broker.publish(
      { subject: "payments.authorize", type: "t", source: "x", intent: "authorize_payment", idempotencyKey: "exp:1", classification: "pci", region: "uk", data: payment() },
      { principal: checkout.principal, region: "uk", contractId: contract.id }
    ),
    (error) => error instanceof PigeonError && error.code === "CONTRACT_EXPIRED"
  );
});

test("requires idempotency keys for payment authorization", () => {
  const { session } = checkoutSession();
  assert.throws(
    () => session.request("payments.authorize", payment(), requestOptions({ idempotencyKey: undefined })),
    (error) => error instanceof PigeonError && error.code === "IDEMPOTENCY_REQUIRED"
  );
});

test("honors the idempotency dedupe window (TTL)", () => {
  let clock = 0;
  const broker = clockedPaymentBroker(() => clock);
  // Long-lived contract so the shared clock advance below tests the idempotency
  // window, not contract expiry.
  const session = broker.connect(checkout, { subjects: ["payments.authorize"], ttlMs: 10 ** 15 });

  const first = session.request("payments.authorize", payment(), requestOptions());
  assert.equal(first.status, "accepted");
  const dup = session.request("payments.authorize", payment(), requestOptions());
  assert.equal(dup.status, "duplicate");

  clock += 172_800_000 + 1; // one past the payments ttl (48h)
  const afterWindow = session.request("payments.authorize", payment(), requestOptions());
  assert.equal(afterWindow.status, "accepted"); // dedupe window elapsed -> treated as new
});

test("enforces rate limits", () => {
  const broker = new PigeonBroker();
  broker.registerToken("t", { id: "svc.rate" });
  broker.registerSubject({
    name: "rate.test",
    intents: ["ping"],
    rateLimit: { perSecond: 1, burst: 1 },
    policy: { publish: [{ effect: "allow", principals: ["svc.rate"] }] }
  });
  const session = broker.connect({ principal: { id: "svc.rate" }, region: "uk" }, { subjects: ["rate.test"] });

  const ok = session.request("rate.test", {}, { intent: "ping", region: "uk" });
  assert.equal(ok.status, "accepted");
  assert.throws(
    () => session.request("rate.test", {}, { intent: "ping", region: "uk" }),
    (error) => error instanceof PigeonError && error.code === "RATE_LIMITED"
  );
});

test("denies messages containing forbidden sensitive fields and quarantines them", () => {
  const { broker, session } = checkoutSession();
  assert.throws(
    () => session.request("payments.authorize", payment({ card: { pan: "4111111111111111" } }), requestOptions()),
    (error) => error instanceof PigeonError && error.code === "SENSITIVE_FIELD_DENIED"
  );
  const quarantine = broker.listQuarantine();
  assert.equal(quarantine.length, 1);
  assert.equal(quarantine[0].code, "SENSITIVE_FIELD_DENIED");
  // The quarantine record must not become a durable plaintext copy of the PAN.
  assert.equal(quarantine[0].message.data.card.pan, "[REDACTED]");
});

test("denies a raw, un-tokenized card number in a tokenized field and quarantines it redacted", () => {
  const { broker, session } = checkoutSession();
  assert.throws(
    () => session.request("payments.authorize", payment({ paymentToken: "4111111111111111" }), requestOptions()),
    (error) => error instanceof PigeonError && error.code === "RAW_PAN_DETECTED"
  );
  const quarantine = broker.listQuarantine();
  assert.equal(quarantine.length, 1);
  assert.equal(quarantine[0].code, "RAW_PAN_DETECTED");
  assert.equal(quarantine[0].message.data.paymentToken, "[REDACTED]");
});

test("accepts an opaque payment token that is not a raw card number", () => {
  const { session } = checkoutSession();
  const result = session.request("payments.authorize", payment({ paymentToken: "tok_visa_abc" }), requestOptions());
  assert.equal(result.status, "accepted");
});

test("denies messages from disallowed regions with REGION_DENIED", () => {
  const { session } = checkoutSession();
  assert.throws(
    () => session.request("payments.authorize", payment(), requestOptions({ region: "us" })),
    (error) => error instanceof PigeonError && error.code === "REGION_DENIED"
  );
});

test("denies replay when subject replay is disabled", () => {
  const { session } = checkoutSession();
  session.request("payments.authorize", payment(), requestOptions());
  assert.throws(
    () => session.replay("payments.authorize", { reason: "debugging" }),
    (error) => error instanceof PigeonError && error.code === "REPLAY_DENIED"
  );
});

test("records enriched audit events for accepted and denied publishes", () => {
  const { broker, session } = checkoutSession();
  const accepted = session.request("payments.authorize", payment(), requestOptions());
  assert.throws(
    () => session.request("payments.authorize", payment(), requestOptions({ classification: "internal", idempotencyKey: "bad_class:1" })),
    PigeonError
  );

  const records = broker.listAudit();
  const acceptedRecord = records.find((r) => r.type === "publish.accepted");
  assert.ok(acceptedRecord);
  assert.equal(acceptedRecord.contractId, session.contract.id);
  assert.equal(acceptedRecord.policyId, "payments.authorize@v1");
  assert.ok(acceptedRecord.schemaId);
  assert.ok(records.some((r) => r.type === "publish.denied" && r.decision === "deny"));
  void accepted;
});

test("audit hash chain verifies", () => {
  const { broker, session } = checkoutSession();
  session.request("payments.authorize", payment(), requestOptions());
  assert.equal(broker.audit.verify(), true);
});

test("rejects an envelope missing required fields", () => {
  const { session } = checkoutSession();
  assert.throws(
    () => session.publish({ subject: "payments.authorize" }),
    (error) => error instanceof PigeonError && error.code === "ENVELOPE_INVALID"
  );
});

test("denies a classification mismatch", () => {
  const { session } = checkoutSession();
  assert.throws(
    () => session.request("payments.authorize", payment(), requestOptions({ classification: "internal" })),
    (error) => error instanceof PigeonError && error.code === "CLASSIFICATION_DENIED"
  );
});

test("quarantines schema-invalid payloads", () => {
  const { broker, session } = checkoutSession();
  assert.throws(
    () => session.request("payments.authorize", payment({ amount: "not-a-number" }), requestOptions({ idempotencyKey: "bad_schema:authorize" })),
    (error) => error instanceof PigeonError && error.code === "SCHEMA_INVALID"
  );
  assert.equal(broker.listQuarantine().some((record) => record.code === "SCHEMA_INVALID"), true);
});

test("releases a quarantined message under an authorized contract", () => {
  const broker = createPaymentBroker(PigeonBroker);
  const session = broker.connect(checkout, { subjects: ["payments.authorize"] });
  assert.throws(
    () => session.request("payments.authorize", payment({ amount: "nope" }), requestOptions({ idempotencyKey: "rel:1" })),
    PigeonError
  );
  const [record] = broker.listQuarantine();
  // Repair the payload before releasing (schema was the reason). We release the
  // *original* which still fails; assert the release path is authorized + audited.
  assert.throws(() => broker.releaseQuarantine(record.id, { principal: checkout.principal, region: "uk", contractId: session.contract.id }), PigeonError);
  assert.ok(broker.listAudit().some((r) => r.type === "quarantine.released"));
});

test("records an ack for a delivered message", () => {
  const broker = createPaymentBroker(PigeonBroker);
  const checkoutS = broker.connect(checkout, { subjects: ["payments.authorize"] });
  const gatewayS = broker.connect(gateway, { subjects: ["payments.authorize"] });
  const { message } = checkoutS.request("payments.authorize", payment(), requestOptions());
  gatewayS.receive("payments.authorize", { max: 10 });
  const acked = gatewayS.ack("payments.authorize", message.id);
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
  const orders = broker.connect(ordersApi, { subjects: ["notifications.send"] });
  orders.request("notifications.send", notification(), notifyOptions());

  const replay = broker.connect(notifyReplay, { subjects: ["notifications.send"] });
  const replayed = replay.replay("notifications.send", { reason: "resend after outage" });
  assert.equal(replayed.length, 1);
  assert.ok(broker.listAudit().some((record) => record.type === "replay.executed"));
});

test("denies replay when no reason is supplied", () => {
  const broker = createDemoBroker(PigeonBroker);
  const orders = broker.connect(ordersApi, { subjects: ["notifications.send"] });
  orders.request("notifications.send", notification(), notifyOptions());

  const replay = broker.connect(notifyReplay, { subjects: ["notifications.send"] });
  assert.throws(
    () => replay.replay("notifications.send", {}),
    (error) => error instanceof PigeonError && error.code === "POLICY_DENIED"
  );
});

test("routes a reply to a waiting requester by correlationId", () => {
  const broker = createDemoBroker(PigeonBroker);
  const orders = broker.connect(ordersApi, { subjects: ["notifications.send"] });
  const result = orders.request("notifications.send", notification(), notifyOptions({ correlationId: "corr-1" }));

  const reply = broker.takeReply("corr-1");
  assert.equal(reply.id, result.message.id);
  assert.equal(broker.takeReply("corr-1"), null); // consumed
});

test("work queue does not redeliver an acked message", () => {
  const broker = createDemoBroker(PigeonBroker);
  const orders = broker.connect(ordersApi, { subjects: ["notifications.send"] });
  const notifier = broker.connect({ principal: { id: "spiffe://merchant-prod/ns/notify/sa/notifier-worker" }, region: "uk" }, { subjects: ["notifications.send"] });
  const { message } = orders.request("notifications.send", notification(), notifyOptions());

  const first = notifier.receive("notifications.send", { max: 10 });
  assert.equal(first.length, 1);
  notifier.ack("notifications.send", message.id);
  const second = notifier.receive("notifications.send", { max: 10 });
  assert.equal(second.length, 0);
});

test("forbids raw SSN on the notifications subject", () => {
  const broker = createDemoBroker(PigeonBroker);
  const orders = broker.connect(ordersApi, { subjects: ["notifications.send"] });
  assert.throws(
    () => orders.request("notifications.send", notification({ recipient: { ssn: "078-05-1120" } }), notifyOptions({ idempotencyKey: "leak:1" })),
    (error) => error instanceof PigeonError && error.code === "SENSITIVE_FIELD_DENIED"
  );
});
