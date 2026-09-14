# Distribution

Pigeon has one broker implementation and multiple protocol clients.

## Channels

| Ecosystem | Package | State |
|---|---|---|
| Node.js / TypeScript | `pigeonmq` on npm | Published |
| Python | `pigeonmq` package manifest under `sdk/python` | SDK implemented and CI-tested; registry publication pending |
| Rust | `pigeonmq` crate manifest under `sdk/rust` | SDK implemented and CI-tested; registry publication pending |
| Any language | Pigeon Protocol v1 HTTP API | Available from the broker |

Do not describe PyPI or crates.io packages as released until the registry project/crate exists and its release workflow has completed successfully.

## Release boundary

The broker and SDKs are versioned independently but declare compatibility with a protocol version.

```text
broker / npm package  ─┐
Python SDK             ├── Pigeon Protocol v1
Rust SDK               ┘
```

This avoids forcing unrelated patch releases to share the same package version while preventing semantic drift.

## npm

The npm package is the broker distribution and JavaScript client:

```bash
npm install pigeonmq
```

It should include runtime source, the first-party JS client, policies/examples needed by the package, README and legal files. Presentation HTML belongs on the `website` branch and is intentionally excluded from the npm package.

## Python / PyPI

Source lives under `sdk/python` with a `pyproject.toml` and package name `pigeonmq`.

Before publishing:

1. verify the `pigeonmq` PyPI project name is available or controlled by this project;
2. run the repository CI against all supported Python versions;
3. build the wheel and sdist from `sdk/python`;
4. inspect package metadata and contents;
5. configure PyPI Trusted Publishing for the GitHub repository/environment;
6. publish a first tagged SDK release;
7. only then replace website copy such as “registry release next” with `pip install pigeonmq`.

Development install today:

```bash
pip install ./sdk/python
```

or from a checkout/reference that explicitly points to the SDK subdirectory.

## Rust / crates.io

Source lives under `sdk/rust` with crate name `pigeonmq`.

Before publishing:

1. verify the `pigeonmq` crate name is available or controlled by this project;
2. require `cargo fmt --check` and `cargo test` against the real broker;
3. run `cargo package` and inspect included files;
4. configure the crates.io publishing credential as a GitHub Actions secret/environment;
5. publish a first tagged SDK release;
6. only then advertise `cargo add pigeonmq` as live.

Development use today can point Cargo at `sdk/rust` from a checkout.

## Conformance gate

A registry release should never be the first place an SDK is tested. The required flow is:

```text
SDK change
   ↓
start real Pigeon broker in CI
   ↓
run language integration/conformance tests
   ↓
package/build validation
   ↓
registry publish
```

Current CI validates Node, Python and Rust against the same broker execution path.

## Future SDKs

Add another official SDK only after the protocol boundary is stable enough to make the client thin. A new SDK should implement the protocol, not reproduce broker policy logic.

Candidate order after current adoption evidence:

1. Go
2. Java/JVM
3. framework adapters (LangGraph, agent SDKs, Temporal, etc.)

Compatibility bridges such as Kafka/NATS/RabbitMQ are broker roadmap work and should not be presented as language SDKs.
