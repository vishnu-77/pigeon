# Public demo hosting

The public Pigeon demo is split so the website remains a presentation/orchestration layer while the broker owns contracts, messages, delivery state, audit and quarantine.

## Public hosts

| Host | Runtime | Source | Purpose |
| --- | --- | --- | --- |
| `www.pigeonmq.cc` | Vercel Next.js | `website` branch | Main landing site |
| `pigeonmq.cc` | redirect | domain configuration | Redirects to `www.pigeonmq.cc` |
| `demo.pigeonmq.cc` | same Vercel project | `website` branch (`/demo`, hostname rewrite in `proxy.ts`) | Interactive live demo |
| `sender.pigeonmq.cc` | Vercel | `main:demo/vercel-sender` | Stateless publisher service |
| `receiver.pigeonmq.cc` | Vercel | `main:demo/vercel-receiver` | Stateless consumer/evidence service |
| `broker.pigeonmq.cc` | persistent container host | `main` + `Dockerfile` + `fly.toml` | Pigeon broker and durable demo state |

## DNS

DNS stays externally managed. For Vercel-backed hosts, use the **exact A/CNAME target Vercel shows for that project/domain** rather than hard-coding generic historical Vercel targets in this document.

Expected records are conceptually:

| Name | Destination |
| --- | --- |
| `@` | current Vercel target for the website project |
| `www` | current Vercel target for the website project |
| `demo` | current Vercel target for the website project |
| `sender` | current Vercel target for the sender project |
| `receiver` | current Vercel target for the receiver project |
| `broker` | persistent broker hostname after deployment |

Only create/activate the broker mapping after the persistent broker host is deployed and its `/health` endpoint returns successfully.

## Why the broker is persistent

Contracts, messages, delivery cursors, audit and quarantine are shared state. The public demo broker therefore runs as one persistent container with `/data` mounted. `PIGEON_DATA_DIR=/data` activates Pigeon's `FileStore` and durable audit log.

The current `fly.toml` targets London (`lhr`) and mounts the `pigeon_data` volume. Before first deployment:

```bash
fly volumes create pigeon_data --region lhr --size 1 -a pigeonmq-demo-broker
fly deploy -a pigeonmq-demo-broker
```

Then attach `broker.pigeonmq.cc` and verify:

```bash
curl https://broker.pigeonmq.cc/health
```

## Vercel project mapping

### Website + demo

Use repository `vishnu-77/pigeon`, production branch `website`, repository root, Next.js framework.

Public domains:

- `www.pigeonmq.cc`
- `demo.pigeonmq.cc`

The browser talks only to the website orchestration API. Backend service URLs remain server-side environment variables.

Recommended website environment:

```text
DEMO_SENDER_URL=https://vercel-sender.vercel.app/api/run
DEMO_RECEIVER_URL=https://vercel-receiver-beta.vercel.app/api/run
DEMO_SENDER_MESSAGE_URL=https://vercel-sender.vercel.app/api/message
DEMO_RECEIVER_MESSAGE_URL=https://vercel-receiver-beta.vercel.app/api/message
DEMO_SENDER_HEALTH_URL=https://vercel-sender.vercel.app/api/health
DEMO_RECEIVER_HEALTH_URL=https://vercel-receiver-beta.vercel.app/api/health
DEMO_BROKER_HEALTH_URL=https://broker.pigeonmq.cc/health
```

Using stable deployment-provider URLs for server-to-server execution keeps the demo independent of the public custom-domain DNS path. The custom subdomains remain useful transparency surfaces.

### Sender

Connect the sender project to `vishnu-77/pigeon`:

- Production branch: `main`
- Root directory: `demo/vercel-sender`
- Public domain: `sender.pigeonmq.cc`

Environment:

```text
PIGEON_URL=https://broker.pigeonmq.cc
PIGEON_DEMO_TOKEN=<public-demo producer token>
PIGEON_PAYMENT_TOKEN=<payment demo producer token>
PIGEON_NOTIFICATION_TOKEN=<notification demo producer token>
```

The repository defaults exist only to make local/demo development reproducible. Public hosting should override them through server-side environment variables.

### Receiver

Connect the receiver project to `vishnu-77/pigeon`:

- Production branch: `main`
- Root directory: `demo/vercel-receiver`
- Public domain: `receiver.pigeonmq.cc`

Environment:

```text
PIGEON_URL=https://broker.pigeonmq.cc
PIGEON_DEMO_RECEIVER_TOKEN=<public-demo consumer token>
PIGEON_PAYMENT_RECEIVER_TOKEN=<payment demo consumer token>
PIGEON_NOTIFICATION_RECEIVER_TOKEN=<notification demo consumer token>
```

The browser never receives broker credentials.

## Live public-demo subjects

The public broker configuration supports three concrete demo paths:

- arbitrary text message → `demo.message`
- payment authorisation → `payments.authorize`
- notification delivery → `notifications.send`

The website may show other applications, including agent-to-tool, A2A, data-processing and deployment-control communication, as examples of where the contract model can apply. They are not presented as live broker subjects until corresponding subject policy and runtime support exist.

## Transport and encryption wording

The public service URLs use HTTPS. Subject policy may declare encryption as required, but transport encryption and storage encryption are deployment properties rather than properties the broker can infer from a JSON payload.

The website should therefore distinguish:

- broker-enforced communication policy;
- HTTPS/TLS supplied by the deployed service path;
- storage encryption supplied by the persistent hosting platform.

Do not describe Pigeon itself as encrypting every message unless payload-level encryption is implemented and verified.
