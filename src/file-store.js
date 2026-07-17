// Durable store (FND-05).
//
// A file-backed implementation of the MemoryStore method surface. Every mutation is
// appended as a JSON line to a write-ahead log; on startup the log is replayed to
// rebuild in-memory state, so messages, idempotency records, cursors, and quarantine
// survive a broker restart. Request/reply correlations are transient and are kept in
// memory only.
//
// This is the append-only-log option from ADR-0002 - deliberately simple, dependency
// free (node:fs), and crash-tolerant for the single-node MVP. A partially written
// trailing line (torn write on crash) is skipped rather than aborting recovery.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { PigeonError } from "./errors.js";

export class FileStore {
  constructor({ path, now = () => Date.now() } = {}) {
    if (!path) {
      throw new PigeonError("BAD_REQUEST", "FileStore requires a path.");
    }
    this.path = path;
    this.now = now;
    this.messages = new Map();
    this.idempotency = new Map();
    this.cursors = new Map();
    this.quarantine = [];
    this.replies = new Map();

    mkdirSync(dirname(path), { recursive: true });
    this.#replay();
  }

  initSubject(subject) {
    if (!this.messages.has(subject)) {
      this.messages.set(subject, []);
      this.#write({ op: "initSubject", subject });
    }
  }

  appendMessage(subject, message) {
    const log = this.#log(subject);
    const committed = { ...message, sequence: log.length + 1 };
    log.push(committed);
    this.#write({ op: "appendMessage", subject, message: committed });
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
    this.#write({ op: "setCursor", key, position });
  }

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
    const at = this.now();
    this.idempotency.set(`${subject}:${key}`, { message, at });
    this.#write({ op: "setIdempotent", subject, key, message, at });
  }

  addQuarantine(record) {
    const stored = { id: `quarantine_${this.quarantine.length + 1}`, ...record };
    this.quarantine.push(stored);
    this.#write({ op: "addQuarantine", record: stored });
    return stored;
  }

  findQuarantine(id) {
    return this.quarantine.find((record) => record.id === id);
  }

  listQuarantine() {
    return [...this.quarantine];
  }

  resolveReply(correlationId, message) {
    this.replies.set(correlationId, message);
  }

  takeReply(correlationId) {
    const message = this.replies.get(correlationId) ?? null;
    this.replies.delete(correlationId);
    return message;
  }

  #apply(event) {
    switch (event.op) {
      case "initSubject":
        if (!this.messages.has(event.subject)) this.messages.set(event.subject, []);
        break;
      case "appendMessage":
        this.#log(event.subject).push(event.message);
        break;
      case "setCursor":
        this.cursors.set(event.key, event.position);
        break;
      case "setIdempotent":
        this.idempotency.set(`${event.subject}:${event.key}`, { message: event.message, at: event.at });
        break;
      case "addQuarantine":
        this.quarantine.push(event.record);
        break;
      default:
        break;
    }
  }

  #replay() {
    if (!existsSync(this.path)) {
      return;
    }
    const contents = readFileSync(this.path, "utf8");
    const lines = contents.split("\n");
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.trim()) continue;
      try {
        this.#apply(JSON.parse(line));
      } catch (error) {
        if (i === lines.length - 1) {
          // Torn trailing line from a crash mid-write: stop replaying further.
          break;
        }
        // A parse failure anywhere *before* the last line is real data loss, not a
        // torn write - fail closed instead of silently dropping every record after it.
        throw new PigeonError(
          "STORE_CORRUPT",
          `${this.path} is corrupt at line ${i + 1}: ${error.message}`,
          { path: this.path, line: i + 1 }
        );
      }
    }
  }

  #write(event) {
    appendFileSync(this.path, `${JSON.stringify(event)}\n`);
  }

  #log(subject) {
    const log = this.messages.get(subject);
    if (!log) {
      throw new PigeonError("SUBJECT_NOT_FOUND", `Subject '${subject}' is not registered.`);
    }
    return log;
  }
}
