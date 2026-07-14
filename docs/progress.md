# Pigeon Progress

> A living snapshot of where the project stands: what ships today, what is in flight, and
> what is next. For the *release history* see [CHANGELOG.md](../CHANGELOG.md); for the
> *long-term plan* see the [Roadmap](vision.md#roadmap) in the vision doc. This file is
> the bridge between the two - update it when a milestone lands or the near-term focus
> shifts.

- **Current version:** `0.1.0` (see [CHANGELOG.md](../CHANGELOG.md))
- **Phase:** 0 - Formal model (this repo), now with policy-compiled session contracts
- **Last updated:** 2026-07-14

## Roadmap status

Phases are defined in [vision.md](vision.md#roadmap). This table tracks their state.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 - Formal model | Subject/envelope spec, policy decisions, retry/idempotency/replay, in-memory broker + HTTP API + audit + quarantine | In progress (MVP shipped) |
| 1 - Single-node broker | Durable storage, gRPC + CloudEvents HTTP, streaming consumers | Not started |
| 2 - K8s control plane | CRDs reconciled into broker runtime config | Not started |
| 3 - Distributed broker | Partitioned subjects, replicated logs, Raft metadata | Not started |
| 4 - Compatibility bridges | Kafka / NATS / RabbitMQ / SQS-SNS source & sink | Not started |

## Shipped (Phase 0)

- **Policy-compiled session contracts** ([ADR-0006](adr/0006-session-contracts.md)): an
  authenticated principal negotiates a contract; every message runs under a validated
  `contract_id` before the per-message gates.
- **Server-side authentication**: identity is bound to the session, never trusted from the
  message or a header.
- Core broker: publish / receive / replay / ack with idempotency (TTL-bounded), duplicate
  suppression, and quarantine of violations ([mvp-architecture.md](mvp-architecture.md)).
- Policy engine: identity, intent, region/residency, classification, and
  forbidden-sensitive-field gates; **policy compiled** into subject/policy/schema IDs and a
  per-principal permission index.
- Rate limiting (per principal + subject token bucket).
- Minimal JSON-shape schema validator; subjects/schemas authorable as JSON files with a
  loader + linter (`pigeon policy lint`).
- Audit log with enriched decision fields, a hash chain, and an optional durable sink;
  durable append-only message store, both replayed on restart.
- HTTP API (`/v1/contracts`, `/v1/messages`, `/v1/subjects`, `/v1/audit`, `/v1/quarantine`,
  quarantine release), `pigeon` CLI (`demo`/`broker start`/`policy lint`/`publish`/
  `quarantine`), a TypeScript SDK, and a live Acme Checkout dashboard at `/` with an API
  reference at `/docs`.
- Enforcement-overhead benchmark (`npm run bench`).
- Payment-authorization and work-queue demos; three-container Docker simulation
  (non-root image, healthcheck).
- CI on Node 22 and 24; SemVer + tag-driven release workflow
  ([ADR-0005](adr/0005-semver-tag-driven-releases.md)); decision log under [adr/](adr/).

## In flight

- Nothing active - the [state-audit backlog](backlog.md) (FND-01..15) is complete.

## Next up

Beyond the MVP boundary, into Phase 1 (see the [Roadmap](vision.md#roadmap)):

- Authenticated identity at the edge (mTLS/SPIFFE/JWT) to replace the demo bearer tokens.
- Durable, distributable session contracts (currently in-memory).
- Streaming consumers and queue leases (delivery is cursor-based).
- A YAML front-end over the JSON policy loader.

## Known limitations (accepted MVP boundaries)

These are deliberate and documented; each links to its rationale.

- Durable storage is a single-node append-only log; not distributed
  ([ADR-0002](adr/0002-in-memory-storage-pluggable-store.md)).
- Structured-JSON policy, not a general policy language
  ([ADR-0003](adr/0003-json-policy-language-over-cedar-rego.md)).
- Authentication uses static demo bearer tokens; real deployments need mTLS/SPIFFE/JWT
  ([ADR-0004](adr/0004-header-based-identity-for-mvp.md)).
- Session contracts are in-memory and single-node
  ([ADR-0006](adr/0006-session-contracts.md)).
