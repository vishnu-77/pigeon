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
import { PigeonError } from "./errors.js";

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
    const lines = contents.split("\n");
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        this.records.push(record);
        this.lastHash = record.hash ?? this.lastHash;
      } catch (error) {
        if (i === lines.length - 1) {
          break; // torn trailing line from a crash
        }
        // A parse failure anywhere before the last line is real data loss, not a
        // torn write - fail closed instead of silently truncating the trail.
        throw new PigeonError(
          "AUDIT_LOG_CORRUPT",
          `${this.path} is corrupt at line ${i + 1}: ${error.message}`,
          { path: this.path, line: i + 1 }
        );
      }
    }

    // The hash chain is the tamper-evidence story - check it at the one moment that
    // matters most: startup after a restart, rather than only if a caller thinks to.
    if (!this.verify()) {
      throw new PigeonError(
        "AUDIT_LOG_TAMPERED",
        `${this.path} failed hash-chain verification on replay: the audit trail may have been altered or truncated.`,
        { path: this.path }
      );
    }
  }
}

function hashRecord(record) {
  const { hash, ...rest } = record;
  return createHash("sha256").update(JSON.stringify(rest)).digest("hex");
}
