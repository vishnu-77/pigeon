# ADR-0001: Dependency-free, standard-library only

- **Status:** Accepted
- **Date:** 2026-07-12
- **Deciders:** Pigeon maintainers
- **Supersedes / Superseded by:** none

## Context

Pigeon is a prototype whose whole argument is that governance guarantees can be *simple
and inspectable*. A broker that pulls in a large dependency tree undercuts that claim: it
becomes hard to audit what is enforced, exposes a supply-chain surface, and raises the
cost of running the demo on a fresh clone. Node's standard library already provides an
HTTP server, crypto, a test runner, and file I/O - enough to build the MVP.

## Decision

We will keep `src/` **free of runtime npm dependencies** and build only on the Node
standard library (`node:*`). The same rule applies to `scripts/`. New dependencies require
discussion in an issue first. The project targets Node >= 22 (ESM).

## Consequences

- `npm test`, `npm run demo`, and `npm start` work on a fresh clone with no install step.
- The audit and policy surface stays small enough to read end to end.
- No third-party supply-chain risk in the shipped package.
- We give up conveniences the ecosystem offers (validation libraries, web frameworks,
  richer policy engines) and reimplement small pieces ourselves - e.g. the minimal
  JSON-shape validator in `src/schema.js`.
- The bar is "standard library or justify it," which slows some feature work by design.

### Alternatives considered

- **Adopt a web framework / validation stack** - faster to build, but a heavier audit
  surface and against the inspectability thesis.
- **Vendor select libraries** - still a maintenance and audit burden; deferred until a
  concrete need outweighs the stdlib approach.
