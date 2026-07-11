import { AuditLog } from "./audit.js";
import { PigeonError, isPigeonError } from "./errors.js";
import { PolicyEngine } from "./policy.js";
import { SchemaRegistry } from "./schema.js";

export class PigeonBroker {
  constructor({ audit = new AuditLog(), policy = new PolicyEngine(), schemas = new SchemaRegistry() } = {}) {
    this.audit = audit;
    this.policy = policy;
    this.schemas = schemas;
    this.subjects = new Map();
    this.messages = new Map();
    this.idempotency = new Map();
    this.quarantine = [];
    this.deliveryCursor = new Map();
  }

  registerSubject(subject) {
    this.subjects.set(subject.name, normalizeSubject(subject));
    this.messages.set(subject.name, []);
    this.audit.write("subject.registered", { subject: subject.name, version: subject.version ?? "v1" });
  }

  registerSchema(name, schema) {
    this.schemas.register(name, schema);
    this.audit.write("schema.registered", { schema: name });
  }

  publish(input, context) {
    const subject = this.getSubject(input.subject);
    const message = normalizeMessage(input);
    const evaluationContext = {
      ...context,
      intent: message.intent,
      region: message.region,
      message
    };

    try {
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
          idempotencyKey: message.idempotencyKey
        });
        return { status: "duplicate", message: duplicate };
      }

      const committed = {
        ...message,
        sequence: this.messages.get(subject.name).length + 1,
        acceptedAt: new Date().toISOString(),
        deliveries: []
      };

      this.messages.get(subject.name).push(committed);
      this.recordIdempotency(subject, committed);

      this.audit.write("publish.accepted", {
        subject: subject.name,
        messageId: committed.id,
        principal: context.principal.id,
        intent: committed.intent,
        region: committed.region
      });

      return { status: "accepted", message: committed };
    } catch (error) {
      this.handlePublishFailure(subject, message, context, error);
      throw error;
    }
  }

  receive(subjectName, context, { max = 1 } = {}) {
    const subject = this.getSubject(subjectName);
    this.policy.assertAllowed("receive", subject, { ...context, region: context.region ?? subject.regionPolicy?.home });

    const cursorKey = `${subjectName}:${context.principal.id}`;
    const start = this.deliveryCursor.get(cursorKey) ?? 0;
    const available = this.messages.get(subjectName).slice(start, start + max);
    this.deliveryCursor.set(cursorKey, start + available.length);

    for (const message of available) {
      message.deliveries.push({
        principal: context.principal.id,
        time: new Date().toISOString(),
        attempt: message.deliveries.length + 1
      });
      this.audit.write("delivery.dispatched", {
        subject: subjectName,
        messageId: message.id,
        principal: context.principal.id
      });
    }

    return available;
  }

  request(subjectName, data, context, options = {}) {
    const result = this.publish({
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

    return result;
  }

  replay(subjectName, context, { reason, fromSequence = 1, toSequence = Infinity } = {}) {
    const subject = this.getSubject(subjectName);

    if (!subject.replay?.allowed) {
      const error = new PigeonError("REPLAY_DENIED", `Replay is disabled for ${subjectName}.`);
      this.audit.write("replay.denied", { subject: subjectName, principal: context.principal.id, reason: reason ?? null });
      throw error;
    }

    this.policy.assertAllowed("replay", subject, {
      ...context,
      reason,
      region: context.region ?? subject.regionPolicy?.home
    });

    const messages = this.messages.get(subjectName)
      .filter((message) => message.sequence >= fromSequence && message.sequence <= toSequence);

    this.audit.write("replay.executed", {
      subject: subjectName,
      principal: context.principal.id,
      reason,
      count: messages.length
    });

    return messages;
  }

  ack(subjectName, messageId, context) {
    const subject = this.getSubject(subjectName);
    this.policy.assertAllowed("ack", subject, { ...context, region: context.region ?? subject.regionPolicy?.home });
    const message = this.findMessage(subjectName, messageId);
    message.ackedBy ??= [];
    message.ackedBy.push({ principal: context.principal.id, time: new Date().toISOString() });
    this.audit.write("delivery.acked", { subject: subjectName, messageId, principal: context.principal.id });
    return message;
  }

  listAudit() {
    return this.audit.all();
  }

  listQuarantine() {
    return [...this.quarantine];
  }

  getSubject(name) {
    const subject = this.subjects.get(name);
    if (!subject) {
      throw new PigeonError("SUBJECT_NOT_FOUND", `Subject '${name}' is not registered.`);
    }
    return subject;
  }

  findMessage(subjectName, messageId) {
    const message = this.messages.get(subjectName)?.find((candidate) => candidate.id === messageId);
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
    return this.idempotency.get(`${subject.name}:${message.idempotencyKey}`) ?? null;
  }

  recordIdempotency(subject, message) {
    if (message.idempotencyKey) {
      this.idempotency.set(`${subject.name}:${message.idempotencyKey}`, message);
    }
  }

  handlePublishFailure(subject, message, context, error) {
    const code = isPigeonError(error) ? error.code : "INTERNAL_ERROR";
    this.audit.write("publish.denied", {
      subject: subject.name,
      messageId: message.id,
      principal: context.principal.id,
      code,
      reason: error.message
    });

    const shouldQuarantine =
      (code === "SCHEMA_INVALID" && subject.quarantine?.onSchemaViolation) ||
      (code === "SENSITIVE_FIELD_DENIED" && subject.quarantine?.onPolicyViolation);

    if (shouldQuarantine) {
      this.quarantine.push({
        id: `quarantine_${this.quarantine.length + 1}`,
        subject: subject.name,
        message,
        code,
        reason: error.message,
        principal: context.principal.id,
        time: new Date().toISOString()
      });
      this.audit.write("quarantine.created", {
        subject: subject.name,
        messageId: message.id,
        principal: context.principal.id,
        code
      });
    }
  }
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

function normalizeMessage(input) {
  return {
    specversion: "1.0",
    id: input.id ?? `msg_${crypto.randomUUID()}`,
    type: input.type,
    source: input.source,
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
