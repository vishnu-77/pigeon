import { PigeonBroker, PigeonError } from "../src/index.js";
import { createDemoBroker } from "../src/subjects.js";

// Colors auto-disable when output is piped or NO_COLOR is set, so the captured
// transcript in the README stays clean while the live terminal stays vivid.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = c("1");
const dim = c("2");
const green = c("32");
const red = c("31");
const yellow = c("33");
const cyan = c("36");
const magenta = c("35");

const ARROW = "──▶";
const LANE = 9;

const broker = createDemoBroker(PigeonBroker);

const checkout = { principal: { id: "spiffe://merchant-prod/ns/checkout/sa/checkout-api" }, region: "uk" };
const attacker = { principal: { id: "spiffe://merchant-prod/ns/catalog/sa/catalog-api" }, region: "uk" };
const gateway = { principal: { id: "spiffe://merchant-prod/ns/payments/sa/gateway-adapter" }, region: "uk" };
const orders = { principal: { id: "spiffe://merchant-prod/ns/orders/sa/orders-api" }, region: "uk" };
const notifier = { principal: { id: "spiffe://merchant-prod/ns/notify/sa/notifier-worker" }, region: "uk" };

header();

section("Subject", "payments.authorize", "request/reply · PCI · idempotent · replay denied · region uk|eu");

scene(1, "Governed payment authorization");
hop("SENDER", "BROKER", "publish authorize_payment (order_456)");
gates([
  ["identity", "checkout-api is an allowed producer", true],
  ["intent", "authorize_payment permitted on subject", true],
  ["schema", "matches payment.authorization.v1", true],
  ["region", "uk is inside uk|eu", true],
  ["sensitive", "no raw card.pan present", true],
  ["idempotency", "order_456:authorize is new", true]
]);
const accepted = pay(checkout, { orderId: "order_456", idempotencyKey: "order_456:authorize" });
outcome(accepted);

scene(2, "Retry with the same idempotency key (no double charge)");
hop("SENDER", "BROKER", "publish authorize_payment (order_456) - retry");
const retry = pay(checkout, { orderId: "order_456", idempotencyKey: "order_456:authorize" });
outcome(retry, "the customer is NOT charged twice - the original message is returned");

scene(3, "Unauthorized producer is denied at admission");
hop("ATTACKER", "BROKER", "publish authorize_payment (order_789)");
const denied = pay(attacker, { orderId: "order_789", idempotencyKey: "order_789:authorize" });
outcome(denied);

scene(4, "Raw card PAN is denied and quarantined as evidence");
hop("SENDER", "BROKER", "publish authorize_payment with card.pan");
const pan = pay(checkout, { orderId: "order_999", idempotencyKey: "order_999:authorize", extra: { card: { pan: "4111111111111111" } } });
outcome(pan);

scene(5, "Receiver pulls only the authorized message");
hop("BROKER", "RECEIVER", "gateway-adapter receives payments.authorize");
const received = safe(() => broker.receive("payments.authorize", gateway, { max: 10 }));
if (Array.isArray(received)) {
  console.log(`   ${green("DELIVERED")} ${received.length} message(s): ${received.map((m) => m.data.orderId).join(", ")}`);
  console.log(`   ${dim("denied and quarantined messages never reach the receiver")}`);
}

scene(6, "Replay is a governed action - denied on this subject");
hop("RECEIVER", "BROKER", "replay payments.authorize");
const replay = safe(() => broker.replay("payments.authorize", gateway, { reason: "debugging" }));
outcome(replay);

section("Subject", "notifications.send", "work queue · PII · replay allowed (audited ops only)");

scene(7, "A different subject, different governance");
hop("SENDER", "BROKER", "orders-api publishes send_notification");
const notify = safe(() => broker.request("notifications.send", {
  recipientId: "cust_42", channel: "email", templateId: "order_shipped", params: { orderId: "order_456" }
}, orders, { intent: "send_notification", idempotencyKey: "order_456:shipped", classification: "pii", region: "uk" }));
outcome(notify);

hop("BROKER", "RECEIVER", "notifier-worker receives notifications.send");
const notifyReceived = safe(() => broker.receive("notifications.send", notifier, { max: 10 }));
if (Array.isArray(notifyReceived)) {
  console.log(`   ${green("DELIVERED")} ${notifyReceived.length} notification(s)`);
}

hop("SENDER", "BROKER", "publish notification carrying recipient.ssn (PII leak)");
const ssn = safe(() => broker.request("notifications.send", {
  recipientId: "cust_42", channel: "email", templateId: "order_shipped", recipient: { ssn: "078-05-1120" }
}, orders, { intent: "send_notification", idempotencyKey: "order_456:leak", classification: "pii", region: "uk" }));
outcome(ssn);

auditTable();
quarantineTable();
footer();

// --- helpers ------------------------------------------------------------

function pay(context, { orderId, idempotencyKey, extra = {} }) {
  return safe(() => broker.request("payments.authorize", {
    merchantId: "merchant_123",
    orderId,
    amount: 42.5,
    currency: "GBP",
    paymentToken: "tok_visa_abc",
    ...extra
  }, context, {
    intent: "authorize_payment",
    idempotencyKey,
    classification: "pci",
    region: "uk"
  }));
}

function safe(fn) {
  try {
    return fn();
  } catch (error) {
    if (error instanceof PigeonError) {
      return { denied: true, code: error.code, message: error.message };
    }
    throw error;
  }
}

function outcome(result, note) {
  if (result?.denied) {
    console.log(`   ${red("DENIED")} ${bold(result.code)} - ${result.message}`);
  } else if (result?.status === "duplicate") {
    console.log(`   ${yellow("DUPLICATE")} returned original ${result.message.id}`);
  } else if (result?.status === "accepted") {
    console.log(`   ${green("ACCEPTED")} ${result.message.id} · seq ${result.message.sequence}`);
  }
  if (result?.code === "SENSITIVE_FIELD_DENIED") {
    console.log(`   ${magenta("QUARANTINED")} envelope held as forensic evidence`);
  }
  if (note) {
    console.log(`   ${dim(note)}`);
  }
}

function hop(from, to, text) {
  const left = pad(from);
  const right = pad(to);
  console.log(`   ${cyan(left)} ${dim(ARROW)} ${cyan(right)}  ${text}`);
}

function gates(list) {
  for (const [name, why, ok] of list) {
    const mark = ok ? green("✓") : red("✗");
    console.log(`     ${mark} ${bold(pad(name, 12))} ${dim(why)}`);
  }
}

function scene(n, title) {
  console.log("");
  console.log(`${bold(`${n}.`)} ${bold(title)}`);
}

function section(label, name, detail) {
  console.log("");
  console.log(dim("─".repeat(74)));
  console.log(`${magenta(bold(label))} ${bold(name)}   ${dim(detail)}`);
  console.log(dim("─".repeat(74)));
}

function pad(text, width = LANE) {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function auditTable() {
  console.log("");
  console.log(bold("Audit trail") + dim("  (immutable, separate from message streams)"));
  for (const record of broker.listAudit()) {
    const colour = record.type.includes("denied") || record.type.includes("quarantine")
      ? red
      : record.type.includes("duplicate")
        ? yellow
        : green;
    const subject = record.subject ? dim(record.subject) : "";
    console.log(`   ${colour(pad(record.type, 22))} ${subject}`);
  }
}

function quarantineTable() {
  const records = broker.listQuarantine();
  if (records.length === 0) {
    return;
  }
  console.log("");
  console.log(bold("Quarantine") + dim("  (governed evidence store)"));
  for (const record of records) {
    console.log(`   ${magenta(pad(record.code, 22))} ${dim(record.subject)} · ${dim(record.reason)}`);
  }
}

function header() {
  console.log("");
  console.log(bold("  Pigeon - governed communication walkthrough"));
  console.log(dim("  Messages carry intent. Subjects carry policy. Brokers enforce guarantees."));
}

function footer() {
  console.log("");
  console.log(dim("─".repeat(74)));
  console.log(`${green(bold("Done."))} Every accept, deny, retry, and quarantine above was policy-driven and audited.`);
  console.log(dim("Run the networked version with: docker compose up --build"));
  console.log("");
}
