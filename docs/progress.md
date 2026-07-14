# Pigeon Progress

> A living snapshot of where the project stands: what ships today, what is in flight, and
> what is next. For the *release history* see [CHANGELOG.md](../CHANGELOG.md); for the
> *long-term plan* see the [Roadmap](vision.md#roadmap) in the vision doc. This file is
> the bridge between the two - update it when a milestone lands or the near-term focus
> shifts.

- **Current version:** `0.1.0` (see [CHANGELOG.md](../CHANGELOG.md))
- **Phase:** 0 - Formal model (this repo)
- **Last updated:** 2026-07-12

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

- Core broker: publish / receive / replay / ack with idempotency, duplicate suppression,
  and quarantine of violations ([mvp-architecture.md](mvp-architecture.md)).
- Policy engine: identity, intent, region/residency, and forbidden-sensitive-field gates
  per subject.
- Minimal JSON-shape schema validator and an example `payments.authorize` subject.
- Immutable audit log; every accept and deny is recorded.
- HTTP API, `pigeon` CLI, and a live Acme Checkout dashboard at `/`, with an API reference
  at `/docs`.
- Payment-authorization and work-queue demos; three-container Docker simulation.
- CI on Node 22 and 24; SemVer + tag-driven release workflow
  ([ADR-0005](adr/0005-semver-tag-driven-releases.md)).
- Decision log started under [docs/adr/](adr/).

## In flight

- Release tooling and living project docs (this change): version-compute script, ADR log,
  and this progress doc.

## Next up

The full ranked work list from the 2026-07-14 state audit lives in
[backlog.md](backlog.md). The near-term head of that list:

- **P0** - Bind producer identity to the authenticated session; stop trusting the
  `x-pigeon-principal` header ([backlog FND-01](backlog.md#fnd-01---bind-producer-identity-to-the-authenticated-session)).
- **P0** - Decide the session-contract vs subject-policy model and record it as an ADR
  ([backlog FND-02](backlog.md#fnd-02---decide-session-contract-vs-subject-policy-model)).
- **P1** - Enrich + persist audit events, compile policy lookups, and add the first durable
  store behind the pluggable seam
  ([ADR-0002](adr/0002-in-memory-storage-pluggable-store.md)).

## Known limitations (accepted MVP boundaries)

These are deliberate and documented; each links to its rationale.

- In-memory storage - state is lost on restart
  ([ADR-0002](adr/0002-in-memory-storage-pluggable-store.md)).
- Structured-JSON policy, not a general policy language
  ([ADR-0003](adr/0003-json-policy-language-over-cedar-rego.md)).
- Header identity is asserted, not authenticated - not production-safe
  ([ADR-0004](adr/0004-header-based-identity-for-mvp.md)).
