# Supermarket POS

Offline-first, multi-branch POS for Sri Lankan supermarkets with an AI Store Assistant.
Design, schema and chatbot tool list: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Status

| Phase | Scope                                       | State       |
| ----- | ------------------------------------------- | ----------- |
| 1     | Repo, DB, auth & RBAC, catalog, admin shell | in progress |
| 2-9   | See architecture doc                        | planned     |

## Quick start

Requires Node 20+, pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env && cp .env apps/api/.env   # edit secrets
pnpm db:up                                       # Postgres :5433, Redis :6379
cd apps/api
pnpm exec prisma migrate deploy
pnpm seed
pnpm dev                                         # API http://localhost:4000, docs at /docs
```

Seeded dev logins (password `ChangeMe123!`, override with `SEED_OWNER_PASSWORD`):
`owner@demo.lk`, `manager@demo.lk`, `cashier1@demo.lk` (PIN login: staff code `C001`, PIN `1234`).
These are development-only credentials. Never seed them in production.

## Tests

```bash
pnpm test                          # unit
pnpm --filter @pos/api test:e2e    # needs the database running and seeded
```

## Environment variables

See [.env.example](.env.example). Secrets are never committed.

## Conventions

Conventional Commits (enforced by commitlint), lint-staged on commit, money as integer minor units,
tax rates stored as data (parts per million), soft deletes on master data, append-only audit log.
