import { AuditLog } from "./audit.js";
import { Authenticator } from "./auth.js";
import { compileSubject, candidateRules } from "./compile.js";
import { ContractRegistry } from "./contracts.js";
import { PigeonError, isPigeonError } from "./errors.js";
import { PolicyEngine } from "./policy.js";
import { RateLimiter } from "./ratelimit.js";
import { SchemaRegistry } from "./schema.js";
import { MemoryStore } from "./store.js";

const REQUIRED_ENVELOPE_FIELDS = ["subject", "type", "source", "intent"];
const OPERATIONS = ["publish", "receive", "ack", "replay"];

export class PigeonBroker {
  constructor({
    audit = new AuditLog(),
    auth = new Authenticator(),
    contracts = new ContractRegistry(),
    policy = new PolicyEngine(),
    rateLimiter = new RateLimiter(),
    schemas = new SchemaRegistry(),
    store = new MemoryStore()
  } = {}) {
    this.audit = audit;
    this.auth = auth;
    this.contracts = contracts;
    this.policy = policy;
    this.rateLimiter = rateLimiter;
    this.schemas = schemas;
    this.store = store;
    this.subjects = new Map();
    this.subjectsById = new Map();
    this.subjectCounter = 0;
  }

  registerSubject(subject) {
    this.subjectCounter += 1;
    const compiled = compileSubject(normalizeSubject(subject), this.subjectCounter);
    this.subjects.set(compiled.name, compiled);
    this.subjectsById.set(compiled.subjectId, compiled);
    this.store.initSubject(compiled.name);
    this.audit.write("subject.registered", {
      subject: compiled.name,
      subjectId: compiled.subjectId,
      policyId: compiled.policyId,
      schemaId: compiled.schemaId,
      version: compiled.version
    });
  }

  registerSchema(name, schema) {
    this.schemas.register(name, schema);
    this.audit.write("schema.registered", { schema: name });
  }

  // Register a bearer token that authenticates as `principal` (FND-01).
  registerToken(token, principal) {
    this.auth.registerToken(token, principal);
    return this;
  }

  // Resolve a bearer credential to a principal server-side. Never trust a
  // client-supplied identity - use this and bind the result to the session.
  authenticate(credential) {
    return this.auth.authenticate(credential);
  }

  listSubjects() {
    return [...this.subjects.values()];
  }

  // Negotiate a session contract for an already-authenticated principal (FND-02).
  // Compiles the policy relevant to the principal + requested subjects into a
  // contract whose operations are decided at identity level; per-message gates
  // (intent, region, schema, ...) still run on every publish.
  negotiate(context, { subjects, ttlMs } = {}) {
    const principal = context.principal;
    if (!principal?.id) {
      throw new PigeonError("UNAUTHENTICATED", "Contract negotiation requires an authenticated principal.");
    }

    const requested = subjects ?? [...this.subjects.keys()];
    const granted = [];
    for (const name of requested) {
      const subject = this.getSubject(name);
      const operations = OPERATIONS.filter((operation) =>
        candidateRules(subject, operation, principal, { region: context.region }).some((rule) => rule.effect === "allow")
      );
      if (operations.length > 0) {
        granted.push({
          name,
          subjectId: subject.subjectId,
          schemaId: subject.schemaId,
          policyId: subject.policyId,
          operations
        });
      }
    }

    const contract = this.contracts.issue(principal.id, granted, { ttlMs });
    this.audit.write("contract.negotiated", {
      contractId: contract.id,
      principal: principal.id,
      subjects: contract.subjects.map((entry) => entry.name),
      policyIds: contract.policyIds,
      expiresAt: contract.expiresAt
    });
    return contract;
  }

  // Convenience: negotiate a contract and return a session bound to it, so callers
  // publish/receive/replay/ack without threading the contract id by hand.
  connect(context, options = {}) {
    const contract = this.negotiate(context, options);
    const bind = { ...context, contractId: contract.id };
    return {
      contract,
      publish: (input) => this.publish(input, bind),
      request: (subjectName, data, requestOptions) => this.request(subjectName, data, bind, requestOptions),
      receive: (subjectName, receiveOptions) => this.receive(subjectName, bind, receiveOptions),
      replay: (subjectName, replayOptions) => this.replay(subjectName, bind, replayOptions),
      ack: (subjectName, messageId) => this.ack(subjectName, messageId, bind)
    };
  }

  publish(input, context) {
    validateEnvelope(input);
    const subject = this.getSubject(input.subject);
    const { subject: contractSubject } = this.contracts.validate(
      context.contractId,
      context.principal.id,
      subject.name,
      "publish"
    );

    // Identity is bound to the authenticated session, not the message body (FND-01).
    const message = normalizeMessage(input, context.principal.id);
    const evaluationContext = { ...context, intent: message.intent, region: message.region, message };
    const decisionMeta = {
      contractId: context.contractId,
      policyId: subject.policyId,
      schemaId: subject.schemaId,
      subjectId: subject.subjectId
    };

    try {
      this.rateLimiter.check(subject, context.principal.id);
      this.policy.assertAllowed("publish", subject, evaluationContext);
      this.enforceSubjectPolicy(subject, message);

      if (subject.schema?.name) {
        this.schemas.validate(subject.schema.name, message.data);
      }

      const duplicate = this.checkDuplicate(subject, message);
      if (duplicate) {
        this.audit.write("publish.duplicate", {
          subject: subject.name,
          messageId: duplicate.id,
          principal: context.principal.id,
          idempotencyKey: message.idempotencyKey,
          ...decisionMeta
        });
        return { status: "duplicate", message: duplicate };
      }

      const committed = this.store.appendMessage(subject.name, {
        ...message,
        contractId: context.contractId,
        subjectId: subject.subjectId,
        schemaId: subject.schemaId,
        acceptedAt: new Date().toISOString(),
        deliveries: []
      });
      this.recordIdempotency(subject, committed);

      this.audit.write("publish.accepted", {
        subject: subject.name,
        messageId: committed.id,
        principal: context.principal.id,
        intent: committed.intent,
        region: committed.region,
        decision: "allow",
        reason: "contract_valid",
        ...decisionMeta
      });

      // Deliver a queued reply back to a waiting requester, if any (FND-09).
      this.routeReply(subject, committed);

      return { status: "accepted", message: committed };
    } catch (error) {
      this.handlePublishFailure(subject, message, context, error, decisionMeta);
      throw error;
    }
  }

  receive(subjectName, context, { max = 1 } = {}) {
    const subject = this.getSubject(subjectName);
    this.contracts.validate(context.contractId, context.principal.id, subject.name, "receive");
    this.policy.assertAllowed("receive", subject, { ...context, region: context.region ?? subject.regionPolicy?.home });

    const cursorKey = `${subjectName}:${context.principal.id}`;
    const start = this.store.getCursor(cursorKey);
    const available = this.store.listMessages(subjectName)
      .slice(start)
      .filter((message) => !isRedeliveryBlocked(subject, message))
      .slice(0, max);

    for (const message of available) {
      message.deliveries.push({
        principal: context.principal.id,
        time: new Date().toISOString(),
        attempt: message.deliveries.length + 1
      });
      this.audit.write("delivery.dispatched", {
        subject: subjectName,
        messageId: message.id,
        principal: context.principal.id,
        contractId: context.contractId
      });
    }

    // Advance the cursor past the highest dispatched message so at-least-once
    // delivery does not silently skip work-queue entries that were held back.
    if (available.length > 0) {
      const lastSequence = available[available.length - 1].sequence;
      const log = this.store.listMessages(subjectName);
      const newCursor = log.findIndex((message) => message.sequence === lastSequence) + 1;
      this.store.setCursor(cursorKey, Math.max(start, newCursor));
    }

    return available;
  }

  request(subjectName, data, context, options = {}) {
    return this.publish({
      subject: subjectName,
      type: options.type ?? `${subjectName}.request`,
      source: context.principal.id,
      intent: options.intent,
      idempotencyKey: options.idempotencyKey,
      classification: options.classification,
      region: options.region,
      data,
      replyTo: options.replyTo,
      correlationId: options.correlationId
    }, context);
  }

  replay(subjectName, context, { reason, fromSequence = 1, toSequence = Infinity } = {}) {
    const subject = this.getSubject(subjectName);

    if (!subject.replay?.allowed) {
      this.audit.write("replay.denied", {
        subject: subjectName,
        principal: context.principal.id,
        reason: reason ?? null,
        contractId: context.contractId,
        policyId: subject.policyId,
        decision: "deny"
      });
      throw new PigeonError("REPLAY_DENIED", `Replay is disabled for ${subjectName}.`);
    }

    this.contracts.validate(context.contractId, context.principal.id, subject.name, "replay");
    this.policy.assertAllowed("replay", subject, {
      ...context,
      reason,
      region: context.region ?? subject.regionPolicy?.home
    });

    const messages = this.store.listMessages(subjectName)
      .filter((message) => message.sequence >= fromSequence && message.sequence <= toSequence);

    this.audit.write("replay.executed", {
      subject: subjectName,
      principal: context.principal.id,
      reason,
      count: messages.length,
      contractId: context.contractId,
      policyId: subject.policyId,
      decision: "allow"
    });

    return messages;
  }

  ack(subjectName, messageId, context) {
    const subject = this.getSubject(subjectName);
    this.contracts.validate(context.contractId, context.principal.id, subject.name, "ack");
    this.policy.assertAllowed("ack", subject, { ...context, region: context.region ?? subject.regionPolicy?.home });
    const message = this.findMessage(subjectName, messageId);
    message.ackedBy ??= [];
    message.ackedBy.push({ principal: context.principal.id, time: new Date().toISOString() });
    this.audit.write("delivery.acked", {
      subject: subjectName,
      messageId,
      principal: context.principal.id,
      contractId: context.contractId
    });
    return message;
  }

  // Collect a reply routed for a correlationId (FND-09). Returns the reply message
  // or null if none has arrived yet.
  takeReply(correlationId) {
    return this.store.takeReply(correlationId);
  }

  listAudit() {
    return this.audit.all();
  }

  listQuarantine() {
    return this.store.listQuarantine();
  }

  // Replay a quarantined message back onto its subject, under a fresh contract held
  // by an authorized principal (FND-11). The original evidence is left in place.
  releaseQuarantine(quarantineId, context) {
    const record = this.store.findQuarantine(quarantineId);
    if (!record) {
      throw new PigeonError("QUARANTINE_NOT_FOUND", `Quarantine record '${quarantineId}' does not exist.`);
    }
    const subject = this.getSubject(record.subject);
    this.contracts.validate(context.contractId, context.principal.id, subject.name, "publish");

    this.audit.write("quarantine.released", {
      subject: subject.name,
      quarantineId,
      principal: context.principal.id,
      contractId: context.contractId
    });

    return this.publish({
      subject: subject.name,
      type: record.message.type,
      source: context.principal.id,
      intent: record.message.intent,
      idempotencyKey: record.message.idempotencyKey,
      classification: record.message.classification,
      region: record.message.region,
      data: record.message.data
    }, context);
  }

  getSubject(name) {
    const subject = this.subjects.get(name);
    if (!subject) {
      throw new PigeonError("SUBJECT_NOT_FOUND", `Subject '${name}' is not registered.`);
    }
    return subject;
  }

  findMessage(subjectName, messageId) {
    const message = this.store.findMessage(subjectName, messageId);
    if (!message) {
      throw new PigeonError("MESSAGE_NOT_FOUND", `Message '${messageId}' does not exist on ${subjectName}.`);
    }
    return message;
  }

  enforceSubjectPolicy(subject, message) {
    if (!subject.intents.includes(message.intent)) {
      throw new PigeonError("INTENT_DENIED", `${message.intent} is not allowed on ${subject.name}.`);
    }

    if (subject.delivery?.idempotency?.required && !message.idempotencyKey) {
      throw new PigeonError("IDEMPOTENCY_REQUIRED", `${subject.name} requires an idempotency key.`);
    }

    if (subject.data?.classification && subject.data.classification !== message.classification) {
      throw new PigeonError("CLASSIFICATION_DENIED", `${subject.name} only accepts ${subject.data.classification} messages.`);
    }

    const allowedRegions = subject.regionPolicy?.allowedRegions ?? [];
    if (allowedRegions.length > 0 && !allowedRegions.includes(message.region)) {
      throw new PigeonError("REGION_DENIED", `${message.region} is not allowed for ${subject.name}.`);
    }

    for (const path of subject.data?.forbiddenFields ?? []) {
      if (hasPath(message.data, path)) {
        throw new PigeonError("SENSITIVE_FIELD_DENIED", `${path} is forbidden on ${subject.name}.`);
      }
    }
  }

  checkDuplicate(subject, message) {
    const config = subject.delivery?.idempotency;
    if (!config?.required || !message.idempotencyKey) {
      return null;
    }
    return this.store.getIdempotent(subject.name, message.idempotencyKey, config.ttlMs);
  }

  recordIdempotency(subject, message) {
    if (message.idempotencyKey) {
      this.store.setIdempotent(subject.name, message.idempotencyKey, message);
    }
  }

  // If this message is a reply carrying a correlationId, hand it to any receiver
  // waiting on that correlation (FND-09, real request/reply).
  routeReply(subject, message) {
    if (message.correlationId) {
      this.store.resolveReply(message.correlationId, message);
    }
  }

  handlePublishFailure(subject, message, context, error, decisionMeta = {}) {
    const code = isPigeonError(error) ? error.code : "INTERNAL_ERROR";
    this.audit.write("publish.denied", {
      subject: subject.name,
      messageId: message?.id,
      principal: context.principal?.id,
      code,
      reason: error.message,
      decision: "deny",
      ...decisionMeta
    });

    const shouldQuarantine =
      subject.quarantine?.onSchemaViolation && code === "SCHEMA_INVALID" ||
      subject.quarantine?.onPolicyViolation &&
        ["SENSITIVE_FIELD_DENIED", "CLASSIFICATION_DENIED", "REGION_DENIED", "INTENT_DENIED"].includes(code);

    if (shouldQuarantine && message) {
      const stored = this.store.addQuarantine({
        subject: subject.name,
        message,
        code,
        reason: error.message,
        principal: context.principal?.id,
        contractId: context.contractId,
        time: new Date().toISOString()
      });
      this.audit.write("quarantine.created", {
        subject: subject.name,
        messageId: message.id,
        quarantineId: stored.id,
        principal: context.principal?.id,
        code,
        ...decisionMeta
      });
    }
  }
}

function validateEnvelope(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PigeonError("ENVELOPE_INVALID", "Message envelope must be an object.", { fields: REQUIRED_ENVELOPE_FIELDS });
  }

  const missing = REQUIRED_ENVELOPE_FIELDS.filter((field) => {
    const value = input[field];
    return typeof value !== "string" || value.trim() === "";
  });

  if (missing.length > 0) {
    throw new PigeonError(
      "ENVELOPE_INVALID",
      `Message envelope is missing required fields: ${missing.join(", ")}.`,
      { fields: missing }
    );
  }
}

// A work-queue message that has already been acked should not be redelivered.
function isRedeliveryBlocked(subject, message) {
  if (subject.mode !== "workQueue") {
    return false;
  }
  return Array.isArray(message.ackedBy) && message.ackedBy.length > 0;
}

function normalizeSubject(subject) {
  return {
    version: "v1",
    mode: "pubsub",
    intents: [],
    policy: {},
    ...subject
  };
}

function normalizeMessage(input, authenticatedSource) {
  return {
    specversion: "1.0",
    id: input.id ?? `msg_${crypto.randomUUID()}`,
    type: input.type,
    source: authenticatedSource ?? input.source,
    subject: input.subject,
    time: input.time ?? new Date().toISOString(),
    intent: input.intent,
    idempotencyKey: input.idempotencyKey,
    classification: input.classification ?? "internal",
    region: input.region ?? "local",
    data: input.data ?? {},
    replyTo: input.replyTo,
    correlationId: input.correlationId
  };
}

function hasPath(value, path) {
  const parts = path.split(".");
  let current = value;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return false;
    }
    current = current[part];
  }
  return true;
}
