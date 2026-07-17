# Changelog

All notable changes to Pigeon are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Policy-compiled session contracts** ([ADR-0006](docs/adr/0006-session-contracts.md)):
  authenticate -> negotiate a contract -> run messages under a validated `contract_id`.
- Server-side authentication (bearer token -> principal); identity is bound to the
  session, never trusted from the message.
- Policy compilation into subject/policy/schema IDs and a per-principal permission index.
- Durable, crash-recoverable append-only store (`PIGEON_DATA_DIR`) and a durable,
  hash-chained audit log; enriched audit events (`contract_id`/`policy_id`/`schema_id`).
- Idempotency dedupe-window (TTL) enforcement; per-principal/subject rate limiting.
- Request/reply routing by `correlationId`; work-queue ack-gated redelivery.
- File-based policy authoring (`policies/`) with a loader + linter; `pigeon` CLI verbs
  (`broker start`, `policy lint`, `publish`, `quarantine`); a TypeScript SDK
  (`sdk/typescript/`); an enforcement-overhead benchmark (`npm run bench`).
- Quarantine expansion (more triggers + authorized release) and a non-root container image
  with a healthcheck.
- Tag-triggered release workflow (`.github/workflows/release.yml`): pushing a
  `v*` tag runs the test suite, optionally publishes to npm, and creates a
  GitHub Release with auto-generated notes.
- This changelog.

### Changed
- Region enforcement is applied once (via subject `regionPolicy`), not doubled.
- HTTP API adds `/v1/contracts` and quarantine release; publish/receive now require a
  contract. The `x-pigeon-principal` header is no longer trusted.

### Fixed
- The published npm package was missing `examples/`, so `pigeon broker start` (and
  `npm start` against an installed copy) crashed with `ENOENT` looking for the
  dashboard/docs HTML. `examples/dashboard.html` and `examples/docs.html` are now
  included in `files`. (#22)
- `subject.data.tokenization = "required"` is now actually enforced: a value in a
  `tokenizedFields` path that looks like a raw, un-tokenized card number (Luhn-valid,
  13-19 digits) is rejected with `RAW_PAN_DETECTED` and quarantined. `encryption` is
  documented as descriptive rather than enforced, since transport/at-rest encryption
  isn't something this layer can verify from message content. (#23)
- Quarantine records no longer retain the raw value of a forbidden or tokenized field
  (e.g. a full card PAN) in plaintext; it is redacted before the record is stored as
  evidence. (#24)
- `FileStore` and `AuditLog` replay now only tolerates a parse failure on the final
  line of the log (a genuine torn write); a parse failure earlier in the file throws
  instead of silently discarding every record after it. `AuditLog` also verifies its
  hash chain on replay and fails closed if it doesn't check out. (#25)

## [0.1.0] - 2026-07-12

Initial MVP release: a dependency-free, single-node prototype of policy-native
messaging.

### Added
- Core broker (`src/broker.js`): publish / receive / replay / ack with
  idempotency, quarantine, and immutable audit logging.
- Policy engine (`src/policy.js`): principal / intent / region rule evaluation.
- Minimal JSON-shape schema validator (`src/schema.js`).
- Example governed subject `payments.authorize` (`src/subjects.js`).
- HTTP API surface (`src/server.js`) and `pigeon` CLI (`src/cli.js`).
- Payment-authorization and work-queue demos, plus a three-container network
  simulation (`docker compose up --build`).
- CI across Node 22 and 24 with a demo smoke test.

[Unreleased]: https://github.com/vishnu-77/pigeon/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vishnu-77/pigeon/releases/tag/v0.1.0
