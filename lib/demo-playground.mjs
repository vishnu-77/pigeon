import { PigeonBroker } from "../src/broker.js";
import { PigeonError } from "../src/errors.js";

const SENDERS = new Set(["my-app", "worker", "checkout", "unknown-service"]);
const REGIONS = new Set(["uk", "eu", "us"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function validField(value, nested = true) {
  return typeof value === "string" && value.length <= 80 &&
    (value === "" || ((nested ? /^[a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*$/ : /^[a-zA-Z_]\w*$/).test(value) &&
      value.split(".").every((part) => !UNSAFE_KEYS.has(part))));
}

export function validatePlayground(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "Enter a message and its communication rules.";
  if (typeof input.subject !== "string" || !/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)*$/.test(input.subject) || input.subject.length > 80) return "Use a subject such as my.message or orders.created (up to 80 characters).";
  if (!SENDERS.has(input.sender)) return "Choose a sender from the demo identities.";
  if (!REGIONS.has(input.region)) return "Choose a supported region.";
  if (input.policy !== undefined) {
    const policy = input.policy;
    if (!policy || typeof policy !== "object" || Array.isArray(policy)) return "Policy must be a JSON object.";
    const fields = ["allowedSenders", "allowedRegions", "forbiddenFields", "requiredFields"];
    if (Object.keys(policy).some((key) => !fields.includes(key))) return "Supported policy fields: allowedSenders, allowedRegions, forbiddenFields, requiredFields.";
    for (const field of fields) {
      if (!Array.isArray(policy[field]) || policy[field].length > 12) return `${field} must be an array with at most 12 entries.`;
    }
    if (!policy.allowedSenders.every((sender) => SENDERS.has(sender))) return "allowedSenders must contain demo identities: my-app, worker, checkout or unknown-service.";
    if (!policy.allowedRegions.length || !policy.allowedRegions.every((region) => REGIONS.has(region))) return "allowedRegions must contain one or more of: uk, eu, us.";
    if (!policy.forbiddenFields.every((field) => field && validField(field)) || !policy.requiredFields.every((field) => field && validField(field, false))) return "Use valid field names in requiredFields and field paths in forbiddenFields.";
  } else {
    if (!SENDERS.has(input.allowedSender)) return "Choose a sender from the demo identities.";
    if (!(REGIONS.has(input.allowedRegion) || input.allowedRegion === "any")) return "Choose a supported region.";
    if (!validField(input.forbiddenField) || !validField(input.requiredField, false)) return "Use a field name such as message, or a blocked path such as card.pan.";
  }
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) return "The message must be a JSON object, for example { \"message\": \"Hello\" }.";
  if (JSON.stringify(input.payload).length > 4096) return "Keep the message under 4,096 characters.";
  return null;
}

// A fresh, in-memory broker per request lets visitors change policy without
// mutating the production catalog or sharing contracts, queues, or credentials.
export function runPlayground(input) {
  const invalid = validatePlayground(input);
  if (invalid) throw new PigeonError("BAD_REQUEST", invalid);
  const started = performance.now();
  const broker = new PigeonBroker();
  const policy = input.policy ?? {
    allowedSenders: [input.allowedSender],
    allowedRegions: input.allowedRegion === "any" ? [...REGIONS] : [input.allowedRegion],
    forbiddenFields: input.forbiddenField ? [input.forbiddenField] : [],
    requiredFields: input.requiredField ? [input.requiredField] : []
  };
  const runId = crypto.randomUUID();
  const principal = (name) => `playground:${name}`;
  const senderToken = crypto.randomUUID();
  const receiverToken = crypto.randomUUID();
  broker.registerToken(senderToken, { id: principal(input.sender) });
  broker.registerToken(receiverToken, { id: "playground:receiver" });
  broker.registerSchema("playground.message.v1", {
    type: "object",
    required: policy.requiredFields,
    properties: {}
  });
  broker.registerSubject({
    name: input.subject,
    intents: ["send_message"],
    schema: { name: "playground.message.v1" },
    regionPolicy: { allowedRegions: policy.allowedRegions },
    data: { forbiddenFields: policy.forbiddenFields },
    quarantine: { onSchemaViolation: true, onPolicyViolation: true },
    policy: {
      publish: [{ effect: "allow", principals: policy.allowedSenders.map(principal) }],
      receive: [{ effect: "allow", principals: ["playground:receiver"] }]
    }
  });
  const receiver = broker.connect({ principal: broker.authenticate(receiverToken), region: input.region }, { subjects: [input.subject] });
  let contract = null;
  let failure = null;
  try {
    const sender = broker.connect({ principal: broker.authenticate(senderToken), region: input.region }, { subjects: [input.subject] });
    contract = sender.contract;
    sender.publish({
      subject: input.subject, type: "playground.message.created", source: input.sender,
      intent: "send_message", region: input.region, data: input.payload
    });
  } catch (error) {
    if (!(error instanceof PigeonError)) throw error;
    const expected = new Set(["NO_PERMITTED_SUBJECTS", "POLICY_DENIED", "REGION_DENIED", "SENSITIVE_FIELD_DENIED", "SCHEMA_INVALID"]);
    if (!expected.has(error.code)) throw error;
    failure = { code: error.code, reason: error.message };
  }
  // Read even after a refusal: the empty inbox is observed, not assumed.
  const messages = receiver.receive(input.subject, { max: 1 });
  const quarantined = broker.listQuarantine();
  const decision = failure ? (quarantined.length ? "QUARANTINE" : "DENY") : "ALLOW";
  return {
    runId, decision, elapsedMs: Math.round((performance.now() - started) * 100) / 100,
    code: failure?.code ?? "ACCEPTED",
    reason: failure?.reason ?? "The message met your rules and reached the receiver.",
    contract, policy,
    receiver: { receivedCount: messages.length, delivered: messages.map(({ id, data }) => ({ id, data })) },
    quarantineCount: quarantined.length,
    audit: broker.listAudit(),
    execution: "isolated-playground"
  };
}
