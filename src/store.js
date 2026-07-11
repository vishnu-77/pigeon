import { PigeonError } from "./errors.js";

/**
 * MemoryStore holds the broker's mutable data plane: the per-subject message
 * log, the idempotency ledger, per-consumer delivery cursors, and the
 * quarantine evidence store.
 *
 * It exists so the broker never touches raw Maps directly. Any durable backend
 * (SQLite, RocksDB, an append-only log, ...) can be dropped in later by
 * implementing the same synchronous method surface:
 *
 *   initSubject(subject)                 -> void
 *   appendMessage(subject, message)      -> committed message (with sequence)
 *   listMessages(subject)                -> message[]
 *   findMessage(subject, id)             -> message | undefined
 *   getCursor(key)                       -> number
 *   setCursor(key, position)             -> void
 *   getIdempotent(subject, key)          -> message | null
 *   setIdempotent(subject, key, message) -> void
 *   addQuarantine(record)                -> record (with id)
 *   listQuarantine()                     -> record[]
 *
 * Subject *configuration* stays on the broker; only mutable runtime state
 * lives here.
 */
export class MemoryStore {
  constructor() {
    this.messages = new Map();
    this.idempotency = new Map();
    this.cursors = new Map();
    this.quarantine = [];
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

  getIdempotent(subject, key) {
    return this.idempotency.get(`${subject}:${key}`) ?? null;
  }

  setIdempotent(subject, key, message) {
    this.idempotency.set(`${subject}:${key}`, message);
  }

  addQuarantine(record) {
    const stored = { id: `quarantine_${this.quarantine.length + 1}`, ...record };
    this.quarantine.push(stored);
    return stored;
  }

  listQuarantine() {
    return [...this.quarantine];
  }

  #log(subject) {
    const log = this.messages.get(subject);
    if (!log) {
      throw new PigeonError("SUBJECT_NOT_FOUND", `Subject '${subject}' is not registered.`);
    }
    return log;
  }
}
