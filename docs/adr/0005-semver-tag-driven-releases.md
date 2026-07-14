# ADR-0005: SemVer, tag-driven releases

- **Status:** Accepted
- **Date:** 2026-07-12
- **Deciders:** Pigeon maintainers
- **Supersedes / Superseded by:** none

## Context

The project had a version in `package.json` but no tags, no changelog, and no release
mechanism - there was no way to mark, publish, or reason about a release. We need a
lightweight, auditable process that fits a zero-dependency repo and does not require
standing services.

## Decision

We will version Pigeon with **Semantic Versioning** and drive releases from **Git tags**:

- The single source of truth for a version is `package.json`; `npm version` bumps it and
  creates the matching `vX.Y.Z` commit and tag.
- Pushing a `v*` tag triggers `.github/workflows/release.yml`, which verifies the tag
  matches `package.json`, runs the tests and demo, optionally publishes to npm (only when
  an `NPM_TOKEN` secret is set, with provenance), and creates a GitHub Release.
- `CHANGELOG.md` follows Keep a Changelog; notes accrue under `[Unreleased]` and move into
  a dated version section at release time.
- `scripts/next-version.mjs` (`npm run version:next`) computes the *suggested* next
  version from Conventional Commits since the last tag. Computation is advisory; a human
  runs `npm version` and pushes the tag.

## Consequences

- Releases are reproducible and gated by CI; the tag/`package.json` match check prevents
  drift.
- npm publishing is opt-in - the repo works as a GitHub-only release until a token is
  added, so nothing breaks in its absence.
- Conventional Commits are encouraged going forward so version computation is meaningful;
  historical commits predating this decision are not conventional and default to a patch
  suggestion.
- Automation never tags or pushes on its own - cutting a release stays a deliberate human
  action.

### Alternatives considered

- **semantic-release / changesets** - fully automated versioning and publishing, but adds
  dependencies and hands the release trigger to CI; heavier than an MVP needs.
- **Manual version edits, no workflow** - no CI gating and easy to get the tag and
  `package.json` out of sync.
