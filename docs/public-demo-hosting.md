# Public demo hosting

The public Pigeon demo is intentionally split so the website can remain a presentation/orchestration layer while the broker owns message state.

## Public hosts

| Host | Runtime | Source | Purpose |
| --- | --- | --- | --- |
| `pigeonmq.cc` | Vercel Next.js | `website` branch | Main landing / developer / researcher site |
| `demo.pigeonmq.cc` | same Vercel project | `website` branch (`/demo`, hostname rewrite in `proxy.ts`) | Interactive live demo |
| `sender.pigeonmq.cc` | Vercel | `main:demo/vercel-sender` | Stateless publisher service |
| `receiver.pigeonmq.cc` | Vercel | `main:demo/vercel-receiver` | Stateless consumer/evidence service |
| `broker.pigeonmq.cc` | persistent container host | `main` + `Dockerfile` + `fly.toml` | Pigeon broker and durable demo state |

## Why the broker is not an ordinary Vercel function

Contracts, messages, delivery cursors, audit and quarantine are shared state. The demo broker therefore runs as one persistent container with `/data` mounted. `PIGEON_DATA_DIR=/data` activates Pigeon's `FileStore` and durable audit log.

The `fly.toml` configuration keeps one machine running in London (`lhr`) and mounts the `pigeon_data` volume. Create the volume before first deploy:

```bash
fly volumes create pigeon_data --region lhr --size 1 -a pigeonmq-demo-broker
fly deploy -a pigeonmq-demo-broker
```

Then attach `broker.pigeonmq.cc` to that deployment and verify:

```bash
curl https://broker.pigeonmq.cc/health
```

## Vercel project mapping

### Landing + demo

Create one Vercel project from `vishnu-77/pigeon` using branch `website` and repository root. Attach both `pigeonmq.cc` and `demo.pigeonmq.cc`. `proxy.ts` rewrites only the demo hostname root to `/demo`.

### Sender

Use the existing `vercel-sender` project or create a replacement connected to `vishnu-77/pigeon`:

- Production branch: `main`
- Root directory: `demo/vercel-sender`
- Domain: `sender.pigeonmq.cc`
- Environment: `PIGEON_URL=https://broker.pigeonmq.cc`

### Receiver

Use the existing `vercel-receiver` project or create a replacement connected to `vishnu-77/pigeon`:

- Production branch: `main`
- Root directory: `demo/vercel-receiver`
- Domain: `receiver.pigeonmq.cc`
- Environment: `PIGEON_URL=https://broker.pigeonmq.cc`

The public browser never receives demo bearer tokens. Sender and receiver functions use the demo credentials server-side only. Replace the repository defaults with Vercel environment variables before wider public use.

## Scenario truthfulness

The broker currently backs two live public-demo scenarios:

- `payments` → `payments.authorize`
- `notifications` → `notifications.send`

The landing/demo site may show additional communication examples to explain Pigeon's wider applicability, but the orchestrator rejects them until a real broker subject/policy exists. This prevents the UI from presenting a payments flow as an AI-agent or deployment flow.
