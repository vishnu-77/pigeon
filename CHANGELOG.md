# Changelog

All notable changes to Pigeon are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Tag-triggered release workflow (`.github/workflows/release.yml`): pushing a
  `v*` tag runs the test suite, optionally publishes to npm, and creates a
  GitHub Release with auto-generated notes.
- This changelog.

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
