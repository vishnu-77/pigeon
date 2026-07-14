// Audit log (FND-03).
//
// Structured, append-only decision evidence. Every allow/deny/quarantine carries the
// decision's identifying fields (policy_id, schema_id, contract_id, ...) supplied by
// the broker. An optional file sink makes the trail durable and tamper-evident: each
// record is chained to the previous one's hash, and the log is replayed on startup so
// evidence survives a restart. Zero runtime dependencies (node:fs, node:crypto).

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

const GENESIS = "0".repeat(64);

export class AuditLog {
  constructor({ path = null } = {}) {
    this.path = path;
    this.records = [];
    this.lastHash = GENESIS;

    if (path) {
      mkdirSync(dirname(path), { recursive: true });
      this.#replay();
    }
  }

  write(type, details) {
    const record = {
      id: `audit_${this.records.length + 1}`,
      type,
      time: new Date().toISOString(),
      ...details
    };
    // Tamper-evidence: chain each record to the previous record's hash.
    record.prevHash = this.lastHash;
    record.hash = hashRecord(record);
    this.lastHash = record.hash;

    this.records.push(record);
    if (this.path) {
      appendFileSync(this.path, `${JSON.stringify(record)}\n`);
    }
    return record;
  }

  all() {
    return [...this.records];
  }

  bySubject(subject) {
    return this.records.filter((record) => record.subject === subject);
  }

  // Verify the hash chain is intact (no record altered or removed).
  verify() {
    let prev = GENESIS;
    for (const record of this.records) {
      if (record.prevHash !== prev) return false;
      const { hash, ...unhashed } = record;
      if (hashRecord(unhashed) !== hash) return false;
      prev = hash;
    }
    return true;
  }

  #replay() {
    if (!existsSync(this.path)) {
      return;
    }
    const contents = readFileSync(this.path, "utf8");
    for (const line of contents.split("\n")) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        this.records.push(record);
        this.lastHash = record.hash ?? this.lastHash;
      } catch {
        break; // torn trailing line from a crash
      }
    }
  }
}

function hashRecord(record) {
  const { hash, ...rest } = record;
  return createHash("sha256").update(JSON.stringify(rest)).digest("hex");
}
