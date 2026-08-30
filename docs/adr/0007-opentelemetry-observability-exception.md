# ADR-0007: OpenTelemetry as a scoped exception to the dependency-free rule

- **Status:** Accepted
- **Date:** 2026-08-30
- **Deciders:** Pigeon maintainers
- **Supersedes / Superseded by:** none (narrows ADR-0001 for one surface)

## Context

ADR-0001 keeps `src/` dependency-free and stdlib-only, on the reasoning that Pigeon's
guarantees should stay simple and inspectable. Issue #6 asks for OpenTelemetry spans and
broker metrics (accepted/denied/duplicate/quarantined counts, latency per gate) on the
publish/receive/replay paths. Unlike the JSON validator or the policy engine, tracing and
metrics aren't a small surface worth reimplementing: a hand-rolled span/counter format
would not speak to real collectors and exporters (Jaeger, Prometheus, etc.), which is the
entire point of instrumenting with an observability standard rather than log lines.

## Decision

We will allow `@opentelemetry/api`, `@opentelemetry/sdk-metrics`, and
`@opentelemetry/sdk-trace-base` as a named, scoped exception to ADR-0001, limited to
`src/observability.js` and its call sites in the broker. The broker keeps a no-op
observability implementation as the default so core enforcement (policy, schema, rate
limiting, store) never has a hard runtime dependency on OTel - only opting into it costs
the install. Any dependency addition outside this scope still needs an issue discussion
per ADR-0001.

## Consequences

- `npm install` now pulls the OTel packages (and their transitive deps); a
  `package-lock.json` is committed going forward to pin that tree. The "no install step
  for runtime" claim in CONTRIBUTING.md is narrowed to "no install step to exercise the
  core broker" - running the observability tests requires `npm install` first.
- Broker core logic stays dependency-free; only the observability layer takes on
  third-party code and its supply-chain surface.
- Future observability work (receive/replay spans, per-gate latency) can extend
  `src/observability.js` without a fresh ADR, as long as it stays inside this scope.

### Alternatives considered

- **Hand-roll minimal span/counter structs** - stays dependency-free, but the output
  wouldn't be consumable by any real OTel collector or exporter, defeating the purpose of
  adopting the standard.
- **Log-line observability only, no tracing/metrics library** - simplest, but doesn't meet
  what issue #6 actually asks for.
