# Hosted PigeonMQ demo

Verified 2026-09-14. The public landing page is https://www.pigeonmq.cc/.
It explains the broker and offers a real, isolated checkout demo with four scenarios.
No payment is charged. This remains an experimental single-node broker.

## Request path

Browser → website routes → separate sender/receiver Vercel functions → Fly broker.

| Role | Project | Working URL |
| --- | --- | --- |
| Landing | Vercel `pigeon` | https://www.pigeonmq.cc |
| Sender | Vercel `vercel-sender` | https://vercel-sender.vercel.app |
| Receiver | Vercel `vercel-receiver` | https://vercel-receiver-beta.vercel.app |
| Broker | Fly `pigeon-broker-demo` | https://pigeon-broker-demo.fly.dev |

Sender and receiver also have `sender.pigeonmq.cc` and `receiver.pigeonmq.cc`
aliases with issued certificates. The website deliberately uses their stable Vercel
service URLs. Each service's `PIGEON_URL` points to the working Fly hostname.

`GET /api/demo/status` checks all three services. `POST /demo/sessions` creates
a visitor session; its `basePath` prefixes contract, publish, receive, ack and
evidence requests. `DELETE` of that base path resets the session. The old website
`POST /api/demo/run` returns 410 with a migration message.

Demo sessions use independent broker instances, expire after five minutes, and are
bounded to 100 active sessions, 150 operations each and 8 KiB request bodies. They
are ephemeral; a broker restart expires active runs. Demo tokens identify synthetic
roles; these public demo interfaces are not a production authentication scheme.

## Verification

```sh
npm test
npm run demo:network
node scripts/verify-hosted-demo.mjs https://www.pigeonmq.cc
```

The hosted smoke check runs two independent visitors with the same idempotency key.
It asserts matching publication, delivery and acknowledgement IDs; suppression of
duplicate delivery; redacted quarantine for forbidden card data; unauthorized
contract rejection; audit acknowledgement; and session cleanup.

The landing page also checks these results before showing success. Browser checks
covered all four scenarios, reset, evidence disclosure and mobile overflow.

## Deployment and source

Broker: run `fly deploy --local-only --ha=false -y` from the repository root.
It updates the existing single machine using `fly.toml`; no persistent volume is
configured for this public demo. Fly may stop it when idle and start it on demand.

Sender and receiver: `vercel deploy --prod --yes` from their corresponding
`demo/vercel-sender` and `demo/vercel-receiver` directories, linked to the projects
above. Only bounded demo forwarding and health endpoints are exposed there.

The public Next.js website lives on the `website` branch. This revision is on
`feat/landing-live-demo`, in the sibling `pigeon-landing-website` worktree. Its
landing markup, CSS, JS and `pigeon-mark.svg` are copied from `examples/` (the CSS
also into `app/globals.css`, which Next.js imports); `lib/website-proxy.js` mirrors
`src/website-proxy.js`. The favicon (`app/icon.svg`), touch icon (`app/apple-icon.png`)
and social image (`public/og.png`, 1200x630) are generated from the same vector trace.
Keep those copies synchronized when changing the demo.
Build with `npm run build` and deploy the linked Vercel `pigeon` project.

## Remaining broker domain cleanup

The old `broker.pigeonmq.cc` DNS record points to the nonexistent
`pigeonmq-demo-broker.fly.dev`. A certificate request is already configured on
the correct app. At the existing DNS provider, replace the `broker` CNAME with
the exact target returned by `fly certs setup broker.pigeonmq.cc`:

```text
broker CNAME 12lzw52.pigeon-broker-demo.fly.dev
```

Then run `fly certs check broker.pigeonmq.cc` and check its `/health` response.
This cleanup does not block the website demo, which uses the working Fly URL.

## Beyond the demo

Production identity, durable session contracts, queue leases/redelivery,
streaming consumers, replication and business response semantics remain separate
broker milestones. An acknowledgement proves receipt in this demo, not a payment
authorization or exactly-once business execution.
