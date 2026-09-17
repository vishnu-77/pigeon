# PigeonMQ website deployment contract

The website and broker are deployed independently.

## Branch roles

| Branch | Role | Expected deployment |
| --- | --- | --- |
| `main` | Broker/runtime source only | Broker and service deployments |
| `website-dev` | Website development/staging | Vercel Preview + `dev.pigeonmq.cc` |
| `website` | Approved production website only | `www.pigeonmq.cc` / `pigeonmq.cc` |

Do not develop directly on `website`. Build, inspect and approve the exact `website-dev` commit first, then promote that tree to `website`.

## Demo domains

Development:
- `dev.pigeonmq.cc` → `website-dev`
- `demo-dev.pigeonmq.cc` → `website-dev` (root rewrites to `/demo`)

Production:
- `www.pigeonmq.cc` / `pigeonmq.cc` → `website`
- `demo.pigeonmq.cc` → `website` (root rewrites to `/demo`)

The homepage demo CTA uses `NEXT_PUBLIC_DEMO_URL` when configured and otherwise falls back to the local `/demo` route, so preview deployments remain testable without a custom domain.

## Environment variables

Configure these independently for Preview (`website-dev`) and Production (`website`):

- `NEXT_PUBLIC_DEMO_URL`
- `DEMO_SENDER_URL`
- `DEMO_RECEIVER_URL`
- `DEMO_SENDER_HEALTH_URL`
- `DEMO_BROKER_HEALTH_URL`
- `DEMO_RECEIVER_HEALTH_URL`
- `PIGEON_DEMO_SHARED_KEY`

Development deployments deliberately do **not** fall back to production demo backends. If Preview endpoints are not configured, the demo reports `UNCONFIGURED` instead of sending development traffic to production.

## Promotion gate

Before moving `website-dev` to `website`:

1. `npm ci --no-audit --no-fund`
2. `npm run build`
3. Vercel Preview succeeds
4. Check desktop + mobile layout
5. Check reduced-motion behaviour
6. Check all navigation and outbound links
7. Check `/demo` and service health
8. Verify development backend endpoints are isolated from production
9. Approve the exact commit SHA
10. Promote that exact tree to `website`
11. Create a website release tag for the approved production commit

Rollback must use a previously approved website release commit/tag, never a date-based guess from `main`.
