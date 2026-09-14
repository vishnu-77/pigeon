# Changelog

All notable changes to Pigeon are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-09-14

This section also collects the entries that shipped in 1.0.0 to 1.0.2 but were never
moved out of Unreleased at the time.

### Added
- OpenTelemetry decision metrics and spans for publish, receive, replay and ack
  ([ADR-0007](docs/adr/0007-opentelemetry-observability-exception.md)).
- Python and Rust Pigeon Protocol v1 clients with broker integration and conformance
  tests in CI; SDK versions are synchronised with the broker release.
- First-party JavaScript client exported from the package root
  (`import { PigeonClient } from "pigeonmq"`), with `ack()`; `sdk/typescript` re-exports it.
- Signed federation authority primitives and the federation-native authority model
  ([ADR-0008](docs/adr/0008-federation-native-authority.md)).
- Reproducible enforcement benchmark run in CI; a public demo subject registered on broker startup.
- Release pipeline publishing to npm, PyPI/TestPyPI and crates.io through trusted publishing.
- PigeonMQ landing page with a real, isolated four-scenario message demo and mobile layout.
- Brand mark: the origami pigeon logo traced to a 2 KB SVG (`examples/pigeon-mark.svg`) and used
  for the landing page header, hero, broker stop, footer, favicon, touch icon and social image.
  The landing page now uses the paper, navy and coral palette drawn from the logo, and the
  "Experimental" project note was removed from the live page.
- Bounded visitor sessions, separate hosted sender/receiver forwarding services and a
  concurrent hosted-flow verification script.
- HTTP/SDK acknowledgement with prior-delivery checks and durable delivery/ack records.
- `npm run demo:network`: a verified broker/sender/receiver HTTP demo with process cleanup.
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
- The broker ships without a presentation UI: `/` returns machine-readable service metadata
  and `/docs` is no longer served by the broker. The website serves the landing page and the
  API reference (with a `/v1` passthrough for its Try-it controls).
- Custom store adapters must implement `recordDelivery(subject, id, delivery)` and
  `recordAck(subject, id, acknowledgement)` so delivery state can be persisted.
- Region enforcement is applied once (via subject `regionPolicy`), not doubled.
- HTTP API adds `/v1/contracts` and quarantine release; publish/receive now require a
  contract. The `x-pigeon-principal` header is no longer trusted.

### Fixed
- Demo clients verify deduplication, exact denial, redacted quarantine and acknowledgement;
  runs use fresh IDs and fail when required peers or evidence are absent.
- Dashboard acknowledges deliveries and refreshes stale contracts; API-reference Try-it
  controls now authenticate and negotiate contracts.
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

[Unreleased]: https://github.com/vishnu-77/pigeon/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/vishnu-77/pigeon/compare/v0.1.0...v1.1.0
[0.1.0]: https://github.com/vishnu-77/pigeon/releases/tag/v0.1.0
