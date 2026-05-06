# Contributing

## Setup

Install dependencies:

```sh
bun install
```

Create `.env` from `.env.example`. The API needs Postgres through `DATABASE_URL`.

Run the app:

```sh
bun dev
```

Run the dashboard with the same database:

```sh
bun run --cwd apps/dashboard dev
```

## Checks

Run before opening a PR:

```sh
bun run check
bun run test
```

`bun run test` needs Docker for the database-backed suites. `bun run docker:smoke` also needs Docker and checks the deploy-shaped local stack.

## Architecture

Keep the existing shape:

- Browser feature code lives under `domain`, `application`, and `view`.
- Shared browser UI belongs in `apps/web/src/shared/ui`.
- API code is split by `db`, `files`, `platform`, `tree`, and `workspace`.
- Shared app contracts belong in `packages/core` or `packages/protocol`.

Do not add a new pattern unless it removes real duplication. Prefer small modules with clear names over broad abstractions.

## Dashboard Privacy

The dashboard is aggregate-only. Do not expose pad names, pad paths, root names, or root paths in `/api/stats` or in dashboard UI.

## Docker

Dokploy builds the API from `apps/api/Dockerfile` with repo root as the context. The repo only keeps `compose.local.yml` for local checks.
