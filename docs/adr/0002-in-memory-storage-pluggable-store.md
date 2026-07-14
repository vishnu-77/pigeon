# ADR-0002: In-memory storage behind a pluggable store

- **Status:** Accepted
- **Date:** 2026-07-12
- **Deciders:** Pigeon maintainers
- **Supersedes / Superseded by:** none

## Context

The broker needs to append messages, look up idempotency keys, hold quarantined
envelopes, and serve delivery cursors. A durable datastore (Postgres, a log like Kafka)
would be closer to production but adds operational weight, an external dependency, and
setup friction that works against the "runs on a fresh clone" goal (see
[ADR-0001](0001-dependency-free-stdlib-only.md)). The MVP's job is to demonstrate the
governed-communication *model*, not durability.

## Decision

We will store broker state **in memory** (`MemoryStore`) for the MVP, but access it
through a **narrow store interface** so the persistence layer is pluggable. The broker
depends on the interface, not on the in-memory implementation.

## Consequences

- Zero setup: the broker and demos run with no database.
- State is lost on restart, and there is no horizontal scale-out - acceptable for a
  single-node prototype, not for production.
- Because the seam exists, a durable store (SQL, append-only log) can be added later
  without changing broker logic - it is a next step, not a rewrite.
- Tests can drive the store directly and deterministically.

### Alternatives considered

- **Embed SQLite** - durable and still local, but adds a dependency or native binding and
  more surface than the MVP needs.
- **Require Postgres/Kafka** - production-shaped but heavy setup, against MVP goals.
