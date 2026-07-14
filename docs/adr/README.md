# Architecture Decision Records

This directory holds Pigeon's **Architecture Decision Records (ADRs)** - short documents
that capture a significant technical decision, the context that forced it, and the
consequences we accepted. They are the *why* behind the code and the tradeoffs listed in
[../mvp-architecture.md](../mvp-architecture.md).

An ADR is worth writing when a choice is hard to reverse, shapes the public contract, or
would otherwise survive only as tribal knowledge - which storage model to use, which
policy language, how identity is proven, how releases are cut.

## Status lifecycle

```text
Proposed  ->  Accepted  ->  Superseded (by ADR-NNNN)
                   \
                    ->  Deprecated
```

- **Proposed** - under discussion, not yet in effect.
- **Accepted** - the decision currently in force.
- **Superseded** - replaced by a later ADR; kept for the historical record.
- **Deprecated** - no longer applies, but not directly replaced.

ADRs are immutable once accepted. To change a decision, write a new ADR that supersedes
the old one and update the old one's status - never rewrite history.

## Writing a new ADR

1. Copy [0000-template.md](0000-template.md) to `NNNN-short-title.md`, using the next
   free number (zero-padded to four digits).
2. Fill in Context, Decision, Status, and Consequences. Keep it to a page.
3. Add a row to the index below.
4. If it changes the built system, update [../mvp-architecture.md](../mvp-architecture.md)
   and, if user-visible, note it in the [CHANGELOG](../../CHANGELOG.md).

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-dependency-free-stdlib-only.md) | Dependency-free, standard-library only | Accepted |
| [0002](0002-in-memory-storage-pluggable-store.md) | In-memory storage behind a pluggable store | Accepted |
| [0003](0003-json-policy-language-over-cedar-rego.md) | Structured-JSON policy language over Cedar/Rego | Accepted |
| [0004](0004-header-based-identity-for-mvp.md) | Header-based identity for the MVP | Accepted |
| [0005](0005-semver-tag-driven-releases.md) | SemVer, tag-driven releases | Accepted |
| [0006](0006-session-contracts.md) | Policy-compiled session contracts | Accepted |
