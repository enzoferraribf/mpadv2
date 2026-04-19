# Deploy

## Dokploy

This deploy uses two Dokploy resources:

- one Dokploy Postgres database
- one Dokploy application built from the root `Dockerfile`

### 1. Create Postgres

Create a Postgres database in Dokploy and copy its `DATABASE_URL`.

### 2. Create the app

- Build from the root `Dockerfile`
- Domain: `<domain>`
- Set env:
  - `DATABASE_URL=<dokploy postgres connection string>`
  - `APP_ORIGIN=https://<domain>` required in production
  - `RUN_SCHEMA_MIGRATIONS_ON_BOOT=1`
  - `PORT=4000`

The runtime image sets `NODE_ENV=production` itself. `APP_ORIGIN` must match the deployed browser origin exactly so CORS and WebSocket origin checks stay same-origin only.

The Bun server serves all of these on the same origin:

- `/health`
- `/api/*`
- `/ws/:roomName`
- built client assets
- SPA fallback routes

### Local Docker Check

Use these before pushing if you want one local deploy-shaped smoke run:

```sh
bun run docker:build
bun run docker:local-up
bun run docker:local-test
bun run docker:local-down
```

### Verify

- Open `https://<domain>/health`
- Open `https://<domain>`
- Create or edit a pad
- Refresh the page and confirm the data is still there

## One-Time Legacy Import

This is separate from normal deployment.

The Turso -> Postgres backfill lives under `tools/legacy-import` and is only for one-time cutover or manual backfill work. It is not part of normal Dokploy deploys and it is not the same thing as Postgres schema migrations.

Current command:

```sh
bun run legacy:import
```

Use it only when you want to copy legacy Turso data into Postgres.
