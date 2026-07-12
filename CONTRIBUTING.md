# Contributing to Pigeon

Thanks for your interest in Pigeon - a policy-native messaging prototype. This project
is an MVP, so contributions of all sizes are welcome: bug reports, docs, tests, and
new subjects/policies.

## Ground rules

- Be respectful. This project follows a [Code of Conduct](CODE_OF_CONDUCT.md).
- Keep the core **dependency-free**. Pigeon deliberately ships with zero runtime
  dependencies (standard-library Node only). Please don't add npm dependencies to
  `src/` without discussing it in an issue first.
- Discuss large or breaking changes in an issue before opening a PR.

## Development setup

Pigeon targets **Node.js >= 22** (ESM). If you use `nvm`:

```bash
nvm use          # reads .nvmrc (Node 22)
```

Clone and run the checks:

```bash
git clone https://github.com/vishnu-77/pigeon.git
cd pigeon
npm test         # runs the node:test suite
npm run demo     # runs the payment authorization demo
npm start        # starts the HTTP broker on :8787
```

There is no build step and no install step for runtime - `npm test` works on a fresh
clone.

## Container simulation

```bash
docker compose up --build
```

This starts a broker, a checkout sender, and a gateway receiver on one Docker network.
See [docs/local-container-simulation.md](docs/local-container-simulation.md).

## Project layout

| Path | What lives here |
|------|-----------------|
| `src/broker.js` | Core broker: publish/receive/replay/ack, idempotency, quarantine. |
| `src/policy.js` | Principal/intent/region rule evaluation. |
| `src/schema.js` | Minimal JSON-shape validator. |
| `src/subjects.js` | Example subject + schema definitions (`payments.authorize`). |
| `src/audit.js` | In-memory immutable audit log. |
| `src/server.js` | HTTP API surface. |
| `src/cli.js` | `pigeon demo` command. |
| `tests/` | `node:test` suite. |

## Adding a new subject

1. Define the schema and subject object in `src/subjects.js` (or a new module),
   following the shape of `paymentsAuthorizeSubject`.
2. Register them on a broker via `registerSchema()` / `registerSubject()`.
3. Add tests in `tests/` mirroring `tests/broker.test.js`.

## Submitting changes

1. Fork and create a feature branch: `git checkout -b my-change`.
2. Make your change and **add or update tests**. `npm test` must pass.
3. Keep commits focused and messages descriptive.
4. Open a pull request against `main` and fill out the PR template.

## Recording decisions (ADRs)

Significant technical decisions are captured as [Architecture Decision
Records](docs/adr/) - short docs describing the context, the decision, and the
consequences we accepted. Write one when a choice is hard to reverse, shapes the public
contract, or would otherwise survive only as tribal knowledge. Copy
[docs/adr/0000-template.md](docs/adr/0000-template.md) to the next number, fill it in, and
add a row to the [ADR index](docs/adr/README.md).

## Keeping the status current

[docs/progress.md](docs/progress.md) is the living snapshot of what ships today, what is in
flight, and what is next. When you land a milestone or shift the near-term focus, update it
in the same PR. It links to [CHANGELOG.md](CHANGELOG.md) (history) and the
[Roadmap](docs/vision.md#roadmap) (the plan) rather than duplicating them.

## Releasing

Pigeon follows [Semantic Versioning](https://semver.org). Releases are cut from
`main` and driven by Git tags - **pushing a `v*` tag is the release trigger.**

1. Make sure `main` is green and you're up to date.
2. See the suggested next version, computed from Conventional Commits since the last tag:

   ```bash
   npm run version:next
   ```

   (Inside Claude Code, the `/version` command wraps this and can apply the bump for you.)
3. Move the relevant notes from the `## [Unreleased]` section of
   [CHANGELOG.md](CHANGELOG.md) into a new version section, and update the compare
   links at the bottom.
4. Bump the version and create the tag in one step:

   ```bash
   npm version patch   # or: minor | major
   ```

   This updates `package.json` and creates a matching `vX.Y.Z` commit + tag.
5. Push the commit and tag:

   ```bash
   git push --follow-tags
   ```

The [`release` workflow](.github/workflows/release.yml) then verifies the tag
matches `package.json`, runs the test suite and demo, creates a GitHub Release
with auto-generated notes, and - if an `NPM_TOKEN` repository secret is
configured - publishes to npm with provenance. Without that secret the release
is GitHub-only; the publish step is skipped rather than failing.

## Reporting security issues

Please do **not** open a public issue for security vulnerabilities. See
[SECURITY.md](SECURITY.md) for the reporting process.
