# Pigeon Backlog

> Ranked, actionable work derived from the current-state audit (2026-07-14). Each item
> states the current state, why it matters, the fix, the files likely involved, and
> acceptance criteria so "done" is unambiguous. Priorities: **P0** (do first) ->
> **P3** (later). This is the execution list behind [progress.md](progress.md); the
> *why* behind larger choices lands in [adr/](adr/).

## Summary

| ID | Priority | Item | Area | Status |
| --- | --- | --- | --- | --- |
| FND-01 | P0 | Bind producer identity to the authenticated session | Security | Open |
| FND-02 | P0 | Decide session-contract vs subject-policy model (ADR) | Product | Open |
| FND-03 | P1 | Enrich + persist audit events (`contract_id`/`policy_id`/`schema_id`) | Audit | Open |
| FND-04 | P1 | Compile policy/subject/schema into lookup tables | Performance | Open |
| FND-05 | P1 | First durable store behind the `MemoryStore` seam | Storage | Open |
| FND-06 | P2 | Enforce the idempotency dedupe window (TTL) | Correctness | Open |
| FND-07 | P2 | Rate limiting / throughput limits | Security | Open |
| FND-08 | P2 | Non-root container + Dockerfile healthcheck | Ops | Open |
| FND-09 | P2 | Make `mode` / `ack` / request-reply real (or stop advertising) | Broker | Open |
| FND-10 | P2 | Contract / enforcement-overhead benchmark | Performance | Open |
| FND-11 | P2 | Expand quarantine (triggers, replay-from-quarantine, visibility) | Quarantine | Open |
| FND-12 | P2 | Collapse doubled region enforcement | Simplification | Open |
| FND-13 | P3 | CLI verbs (`broker start`, `policy lint`, `publish`, `quarantine`) | CLI/DX | Open |
| FND-14 | P3 | YAML policy source + lint + compile step | Policy | Open |
| FND-15 | P3 | First SDK (Go or TypeScript) | SDK | Open |

---

## P0 - do first

### FND-01 - Bind producer identity to the authenticated session

- **Current state:** the producer principal is read from the `x-pigeon-principal` HTTP
  header and defaults to `"anonymous"`; it is never bound to an authenticated connection.
- **Why it matters:** any caller can set that header to any SPIFFE ID and pass every policy
  gate. The whole governance story is bypassable with one header - the single most important
  defect.
- **Fix:** add an authentication step (shared secret, mTLS CN, or a signed-token stub) that
  resolves the principal server-side; derive the message `source`/principal from the
  authenticated session and ignore client-supplied identity.
- **Files:** `src/server.js:118` (`contextFromHeaders`), `src/broker.js:119` (`request`
  source), `src/broker.js:38` (publish context).
- **Acceptance:** a request whose body/header claims a principal it did not authenticate as
  is denied; a new adversarial test (`producer spoofing blocked`) passes; ADR-0004 updated
  or superseded.

### FND-02 - Decide session-contract vs subject-policy model

- **Current state:** policy is enforced per message by scanning rule arrays; there is no
  handshake, `contract_id`, or compiled contract. The "policy-compiled session contract"
  thesis is not implemented in code or docs.
- **Why it matters:** this is the product's differentiator. Either it becomes real, or the
  positioning should be ratified as a "policy-native subject broker" and the contract
  language dropped. Everything below (audit IDs, compilation, message frame) depends on the
  answer.
- **Fix:** write an ADR choosing one path. If contracts: implement a minimal `HELLO`/
  negotiate step that compiles the relevant policy for an authenticated principal + requested
  subjects/ops into an in-memory `contract_id` (with subject/schema IDs + expiry), and
  validate `contract_id` + `subject_id` + operation on each publish. No persistence required
  to prove it.
- **Files:** new `docs/adr/0006-session-contracts.md`; if building: new
  `src/contracts.js`, `src/broker.js` (publish path), `src/server.js` (handshake route).
- **Acceptance:** ADR merged with a clear decision. If contracts chosen: a publish without a
  valid contract is denied; the payment demo shows handshake -> publish -> denial -> audit.

---

## P1 - foundations

### FND-03 - Enrich and persist audit events

- **Current state:** audit records are an in-memory array; accepted/denied/quarantine events
  omit `policy_id`, `schema_id`, and (future) `contract_id`, and are lost on restart with no
  integrity.
- **Why it matters:** governance evidence that vanishes on restart and cannot tie a decision
  to the policy/contract that made it is not credible evidence.
- **Fix:** add `policy_id`/`schema_id`/`contract_id` to audit writes; make the sink durable
  (append-to-file at minimum) behind an interface; consider a hash chain for tamper-evidence.
- **Files:** `src/audit.js`, `src/broker.js` (all `audit.write` calls).
- **Acceptance:** every allow/deny/quarantine event carries the decision's policy + schema
  (+ contract) IDs; audit survives a broker restart; a test asserts the fields are present.

### FND-04 - Compile policy/subject/schema into lookup tables

- **Current state:** `PolicyEngine.evaluate` linearly scans the rule array on every action;
  subjects are keyed by string name; no numeric IDs.
- **Why it matters:** it is the wrong shape for the "compiled" thesis and there is no
  compiled table to build contracts from. (Cost is negligible at 2 subjects, so this is
  foundational, not urgent-for-latency.)
- **Fix:** add a compile step that validates policy, assigns subject/policy/schema IDs, and
  builds permission maps used at runtime.
- **Files:** new `src/compile.js`; `src/policy.js`, `src/broker.js`, `src/subjects.js`.
- **Acceptance:** runtime enforcement reads compiled tables; IDs are assigned deterministically;
  existing tests still pass.

### FND-05 - First durable store behind the `MemoryStore` seam

- **Current state:** all broker state is in memory; sequences are non-durable; no crash
  recovery ([ADR-0002](adr/0002-in-memory-storage-pluggable-store.md)).
- **Why it matters:** the gate into Phase 1; replay and audit are only as trustworthy as
  their persistence.
- **Fix:** implement one durable backend (append-only segment log or SQLite) implementing the
  existing `MemoryStore` method surface; add a restart-recovery test.
- **Files:** new `src/store-<backend>.js`; `src/store.js` (interface doc), `src/broker.js`
  (injection).
- **Acceptance:** messages/idempotency/cursors/quarantine survive restart; a durability test
  restarts the store and asserts state is intact.

---

## P2 - hardening and honesty

### FND-06 - Enforce the idempotency dedupe window (TTL)

- **Current state:** `idempotency.ttlMs` is configured on subjects but `MemoryStore` never
  expires ledger entries (`src/store.js:67`).
- **Why it matters:** unbounded memory growth and a dedupe window that does not actually
  bound anything.
- **Fix:** store insert time; expire on read/write past `ttlMs`.
- **Files:** `src/store.js`, `src/broker.js` (`checkDuplicate`/`recordIdempotency`).
- **Acceptance:** a duplicate outside the window is treated as new; a test covers expiry.

### FND-07 - Rate limiting / throughput limits

- **Current state:** none, despite policy vocabulary implying throughput controls.
- **Why it matters:** an ungoverned publish rate undercuts the governance claim and invites
  abuse.
- **Fix:** per-principal/subject token-bucket checked on the publish path; deny with a clear
  code when exceeded.
- **Files:** `src/broker.js` (publish path), `src/policy.js` or subject config.
- **Acceptance:** exceeding a configured rate is denied and audited; a test covers it.

### FND-08 - Non-root container + Dockerfile healthcheck

- **Current state:** the image runs as root; the `HEALTHCHECK` lives only in compose.
- **Why it matters:** basic container hardening and self-reported liveness.
- **Fix:** add `USER node` and a `HEALTHCHECK` to the `Dockerfile`.
- **Files:** `Dockerfile`.
- **Acceptance:** container runs as non-root; `docker inspect` shows a healthcheck.

### FND-09 - Make `mode` / `ack` / request-reply real (or stop advertising)

- **Current state:** `subject.mode` never changes behavior; `ack` only records `ackedBy`;
  `request()` is a thin publish with no reply routing.
- **Why it matters:** the API implies delivery semantics it does not provide.
- **Fix:** either implement real semantics (ack-gated redelivery, reply routing via
  `correlationId`) or document these as future and remove the implication from the API/docs.
- **Files:** `src/broker.js` (`receive`/`ack`/`request`), `docs/mvp-architecture.md`.
- **Acceptance:** each advertised mode either behaves distinctly (with tests) or is clearly
  marked not-yet-implemented.

### FND-10 - Contract / enforcement-overhead benchmark

- **Current state:** no benchmarks; the signature metric ("adds X us/message") cannot be
  produced.
- **Why it matters:** the product's honest performance claim is about enforcement overhead,
  not raw throughput - it needs a number.
- **Fix:** a `scripts/bench-*.mjs` measuring publish with/without schema+audit (+contract
  negotiation once FND-02 lands).
- **Files:** new `scripts/bench-enforcement.mjs`; `package.json` script.
- **Acceptance:** running it prints per-gate overhead; documented in a performance note.

### FND-11 - Expand quarantine

- **Current state:** quarantine triggers only on `SCHEMA_INVALID` and
  `SENSITIVE_FIELD_DENIED`; there is no replay-from-quarantine and no CLI visibility (only a
  read API).
- **Why it matters:** governance is incomplete if suspicious-but-not-caught messages are not
  isolated and re-examinable.
- **Fix:** add triggers (unknown classification, oversized, decode failure); add authorized
  replay-from-quarantine; expose via CLI (see FND-13).
- **Files:** `src/broker.js` (`handlePublishFailure`), `src/store.js`, CLI.
- **Acceptance:** the new trigger cases quarantine with a reason; an authorized identity can
  replay a quarantined message; tests cover both.

### FND-12 - Collapse doubled region enforcement

- **Current state:** region is checked both in policy rules and in `enforceSubjectPolicy`, so
  `REGION_DENIED` is largely shadowed by `POLICY_DENIED` (`src/broker.js:207`).
- **Why it matters:** redundant, and the resulting error code is inconsistent.
- **Fix:** pick one layer as authoritative for region and remove the other; align the error
  code.
- **Files:** `src/broker.js` (`enforceSubjectPolicy`), `src/policy.js`, tests.
- **Acceptance:** one region path, one deterministic error code; tests updated.

---

## P3 - later

### FND-13 - CLI verbs

- **Current state:** the CLI is `demo`-only; day-to-day use is via curl or the library.
- **Why it matters:** operability and the DX story.
- **Fix:** add `broker start`, `policy lint`, `publish`, `quarantine` verbs.
- **Files:** `src/cli.js` (+ helpers).
- **Acceptance:** each verb works end to end against a running broker; documented in the
  README quickstart.

### FND-14 - YAML policy source + lint + compile

- **Current state:** policy lives as JS objects in `src/subjects.js`; no on-disk policy, no
  lint.
- **Why it matters:** authoring/versioning/review of policy as data, and the compile step
  (FND-04) needs a source format.
- **Fix:** load policy from YAML/JSON files, validate + lint, compile into runtime tables.
- **Files:** new `policies/`, `schemas/`; `src/compile.js`.
- **Acceptance:** a subject can be defined entirely in files; `policy lint` catches malformed
  policy; runtime uses the compiled result.

### FND-15 - First SDK

- **Current state:** no SDK; examples use raw `fetch`.
- **Why it matters:** adoption - a client that surfaces contracts, required headers, and
  policy denials cleanly.
- **Fix:** one SDK only (Go or TypeScript) covering connect/authenticate/publish/subscribe/
  request-reply with clear denial surfacing.
- **Files:** new `sdk/<lang>/`.
- **Acceptance:** the SDK runs the payment demo end to end, including a denial path.
