# ADR-0004: Header-based identity for the MVP

- **Status:** Accepted
- **Date:** 2026-07-12
- **Deciders:** Pigeon maintainers
- **Supersedes / Superseded by:** none

## Context

The identity gate is the first admission check: the broker must know which principal is
publishing or receiving before it can apply policy. Real deployments would prove identity
with mTLS, signed tokens (JWT/SPIFFE), or a service mesh. Standing that up locally is
heavy and would obscure the governed-communication model the MVP exists to show.

## Decision

For the MVP the HTTP API will take the caller's **principal from a request header**, and
the broker treats that as the asserted identity for policy evaluation. The identity gate
and every downstream policy check operate on it exactly as they would on a
cryptographically proven identity.

## Consequences

- The full admission -> policy -> audit path is demonstrable locally with no auth
  infrastructure.
- Identity is **asserted, not authenticated** - this is not secure against a malicious
  caller and must not be used as-is in production. This is called out in the docs.
- Because policy consumes an already-resolved principal, swapping header identity for a
  real authenticator (mTLS, signed tokens) is a boundary change at the edge, not a rework
  of the policy engine - a clear next step.

### Alternatives considered

- **mTLS / SPIFFE** - production-grade, but heavy local setup, against MVP goals.
- **Signed JWT** - lighter than mTLS but still needs key management and a verifier
  dependency for the demo.
