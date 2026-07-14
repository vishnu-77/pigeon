import { PigeonError } from "./errors.js";

/**
 * MemoryStore holds the broker's mutable data plane: the per-subject message
 * log, the idempotency ledger (with TTL), per-consumer delivery cursors, the
 * quarantine evidence store, and pending request/reply correlations.
 *
 * It exists so the broker never touches raw Maps directly. Any durable backend
 * (a file-backed log, SQLite, RocksDB, ...) can be dropped in later by
 * implementing the same synchronous method surface:
 *
 *   initSubject(subject)                        -> void
 *   appendMessage(subject, message)             -> committed message (with sequence)
 *   listMessages(subject)                       -> message[]
 *   findMessage(subject, id)                    -> message | undefined
 *   getCursor(key)                              -> number
 *   setCursor(key, position)                    -> void
 *   getIdempotent(subject, key, ttlMs?)         -> message | null   (TTL-aware)
 *   setIdempotent(subject, key, message)        -> void
 *   addQuarantine(record)                       -> record (with id)
 *   findQuarantine(id)                          -> record | undefined
 *   listQuarantine()                            -> record[]
 *   resolveReply(correlationId, message)        -> void
 *   takeReply(correlationId)                    -> message | null
 *
 * Subject *configuration* stays on the broker; only mutable runtime state
 * lives here.
 */
export class MemoryStore {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.messages = new Map();
    this.idempotency = new Map();
    this.cursors = new Map();
    this.quarantine = [];
    this.replies = new Map();
  }

  initSubject(subject) {
    if (!this.messages.has(subject)) {
      this.messages.set(subject, []);
    }
  }

  appendMessage(subject, message) {
    const log = this.#log(subject);
    const committed = { ...message, sequence: log.length + 1 };
    log.push(committed);
    return committed;
  }

  listMessages(subject) {
    return this.#log(subject);
  }

  findMessage(subject, id) {
    return this.#log(subject).find((candidate) => candidate.id === id);
  }

  getCursor(key) {
    return this.cursors.get(key) ?? 0;
  }

  setCursor(key, position) {
    this.cursors.set(key, position);
  }

  // TTL-aware idempotency read (FND-06). An entry older than ttlMs is expired: the
  // dedupe window has passed, so the key is treated as new and the record evicted.
  getIdempotent(subject, key, ttlMs) {
    const entry = this.idempotency.get(`${subject}:${key}`);
    if (!entry) {
      return null;
    }
    if (ttlMs && this.now() - entry.at > ttlMs) {
      this.idempotency.delete(`${subject}:${key}`);
      return null;
    }
    return entry.message;
  }

  setIdempotent(subject, key, message) {
    this.idempotency.set(`${subject}:${key}`, { message, at: this.now() });
  }

  addQuarantine(record) {
    const stored = { id: `quarantine_${this.quarantine.length + 1}`, ...record };
    this.quarantine.push(stored);
    return stored;
  }

  findQuarantine(id) {
    return this.quarantine.find((record) => record.id === id);
  }

  listQuarantine() {
    return [...this.quarantine];
  }

  // Request/reply correlation (FND-09). A published reply carrying a correlationId
  // is parked here for the waiting requester to collect with takeReply().
  resolveReply(correlationId, message) {
    this.replies.set(correlationId, message);
  }

  takeReply(correlationId) {
    const message = this.replies.get(correlationId) ?? null;
    this.replies.delete(correlationId);
    return message;
  }

  #log(subject) {
    const log = this.messages.get(subject);
    if (!log) {
      throw new PigeonError("SUBJECT_NOT_FOUND", `Subject '${subject}' is not registered.`);
    }
    return log;
  }
}
