# ADR-0006: Policy-compiled session contracts

- **Status:** Accepted
- **Date:** 2026-07-14
- **Deciders:** Pigeon maintainers
- **Supersedes / Superseded by:** none

## Context

The state audit (2026-07-14) found that Pigeon enforced policy per message by scanning
rule arrays, but had no session contract, no handshake, and no compiled policy tables -
the differentiating "policy-compiled messaging" thesis existed only as framing. The
audit's defining decision (backlog FND-02) was whether to make session contracts real or
to ratify the subject-policy model and drop the contract language.

## Decision

We will make **policy-compiled session contracts** the core primitive.

- An authenticated principal (see [ADR-0004](0004-header-based-identity-for-mvp.md) and its
  successor work) **negotiates** a contract for the subjects + operations it needs.
  Negotiation compiles the policy relevant to that principal into a runtime contract with
  a `contract_id`, per-subject `subjectId`/`schemaId`/`policyId`, the granted operations,
  and an expiry.
- Every `publish`/`receive`/`replay`/`ack` **validates the contract first** (belongs to
  this principal, not expired, subject + operation in scope) before the per-message policy
  gates (intent, region, classification, schema, idempotency, forbidden fields) run.
- Policy is **compiled** on subject registration into deterministic IDs and a
  per-principal permission index, so negotiation and enforcement read tables instead of
  re-scanning raw rules.

Contracts live in memory keyed by id; no durable contract store is required for the MVP.

## Consequences

- The differentiator is now executable and demonstrable: the walkthrough and dashboard
  show negotiate -> publish -> denial -> quarantine -> audit, and an unauthorized producer
  is denied at negotiation (no contract is ever issued).
- Identity is bound to the negotiated contract, closing the header-spoofing hole - a
  principal cannot use another principal's contract.
- Audit events now carry `contract_id`/`policy_id`/`schema_id`, tying each decision to the
  compiled policy that made it.
- Per-message operations gain a required `contract_id`; the library exposes `connect()` to
  hold a session so callers do not thread the id by hand.
- New failure modes exist (contract missing/expired/mismatched/out-of-scope), each with a
  specific error code and fail-closed default.
- Contracts are in-memory and single-node; distributing or persisting them is future work.

### Alternatives considered

- **Ratify the per-message subject-policy model, drop the contract framing** - simpler, but
  abandons the product's reason to exist as distinct from a policy-checking broker.
- **Compile policy without a session contract** - would speed the hot path but would not
  give the negotiated, identity-bound, auditable session the thesis promises.
