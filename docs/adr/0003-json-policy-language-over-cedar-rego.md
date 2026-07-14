# ADR-0003: Structured-JSON policy language over Cedar/Rego

- **Status:** Accepted
- **Date:** 2026-07-12
- **Deciders:** Pigeon maintainers
- **Supersedes / Superseded by:** none

## Context

Each subject carries a policy that the broker evaluates on every message: who may publish,
who may receive, which intents are allowed, region/residency rules, forbidden sensitive
fields, idempotency requirements. A mature policy language (Cedar, OPA/Rego) is
expressive and battle-tested, but pulls in an external engine or dependency, adds a
language for readers to learn, and hides enforcement behind an evaluator - at odds with
Pigeon's inspectability thesis and the zero-dependency rule
([ADR-0001](0001-dependency-free-stdlib-only.md)).

## Decision

We will express subject policy as **structured JSON/JS objects** evaluated by a small,
purpose-built engine in `src/policy.js`. Policy is data - allow-lists of principals and
intents, region sets, forbidden field paths - not a general-purpose rule language.

## Consequences

- Policy is human-readable, diffable, and enforced by code you can read in one file.
- No policy-engine dependency; evaluation is trivially fast and deterministic.
- Expressiveness is limited to what the engine supports; complex conditional logic is not
  representable today. That is an accepted MVP boundary.
- If richer policy is needed later, this ADR would be superseded by one adopting a real
  policy language behind the same subject abstraction.

### Alternatives considered

- **Cedar** - strong authorization model, but an external engine and a new language.
- **OPA / Rego** - powerful and standard, but heavyweight for an MVP and a dependency.
