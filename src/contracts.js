// Session contracts (FND-02).
//
// The core Pigeon primitive: when an authenticated principal negotiates, the broker
// compiles the policy relevant to the principal + requested subjects into a runtime
// *session contract*. Every subsequent message executes under a contract_id that is
// validated (belongs to this principal, not expired, subject+operation in scope)
// before the per-message policy gates run. This turns the hot path from "re-derive
// everything per message" into "look up a compiled contract".
//
// Contracts live in memory keyed by id and bound to the principal that negotiated
// them. Zero runtime dependencies.

import { PigeonError } from "./errors.js";

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class ContractRegistry {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.contracts = new Map();
    this.counter = 0;
  }

  // Issue a contract for an authenticated principal.
  // grantedSubjects: [{ name, subjectId, schemaId, policyId, operations: [...] }]
  issue(principalId, grantedSubjects, { ttlMs = DEFAULT_TTL_MS } = {}) {
    if (!Array.isArray(grantedSubjects) || grantedSubjects.length === 0) {
      throw new PigeonError(
        "NO_PERMITTED_SUBJECTS",
        `${principalId} is not permitted any operation on the requested subjects.`
      );
    }

    this.counter += 1;
    const issuedAt = this.now();
    const contract = {
      id: `contract_${this.counter}`,
      principal: principalId,
      subjects: grantedSubjects.map((subject) => ({
        name: subject.name,
        subjectId: subject.subjectId,
        schemaId: subject.schemaId,
        policyId: subject.policyId,
        operations: [...subject.operations]
      })),
      policyIds: [...new Set(grantedSubjects.map((subject) => subject.policyId).filter(Boolean))],
      issuedAt: new Date(issuedAt).toISOString(),
      expiresAt: new Date(issuedAt + ttlMs).toISOString()
    };
    this.contracts.set(contract.id, contract);
    return contract;
  }

  get(contractId) {
    return this.contracts.get(contractId) ?? null;
  }

  // Validate a contract for a specific operation and return the in-scope subject
  // entry. Fails closed with a specific code for each way a contract can be invalid.
  validate(contractId, principalId, subjectName, operation) {
    if (!contractId) {
      throw new PigeonError("CONTRACT_REQUIRED", `A contract is required to ${operation} on ${subjectName}.`);
    }

    const contract = this.contracts.get(contractId);
    if (!contract) {
      throw new PigeonError("CONTRACT_NOT_FOUND", `Contract '${contractId}' does not exist.`);
    }

    if (contract.principal !== principalId) {
      throw new PigeonError(
        "CONTRACT_PRINCIPAL_MISMATCH",
        `Contract '${contractId}' was not issued to ${principalId}.`
      );
    }

    if (Date.parse(contract.expiresAt) <= this.now()) {
      throw new PigeonError("CONTRACT_EXPIRED", `Contract '${contractId}' has expired.`);
    }

    const subject = contract.subjects.find((entry) => entry.name === subjectName);
    if (!subject) {
      throw new PigeonError("SUBJECT_NOT_IN_CONTRACT", `${subjectName} is not in contract '${contractId}'.`);
    }

    if (!subject.operations.includes(operation)) {
      throw new PigeonError(
        "OPERATION_NOT_IN_CONTRACT",
        `${operation} is not permitted on ${subjectName} under contract '${contractId}'.`
      );
    }

    return { contract, subject };
  }
}
