# Deploy

## Normal Deployment

This deploy uses four Dokploy resources:

- one Dokploy Postgres database
- one `schema-migrate` one-shot service
- one `api` service
- one `client` service

### 1. Create Postgres

Create a Postgres database in Dokploy and copy its `DATABASE_URL`.

### 2. Create `schema-migrate`

- Build from `Dockerfile.schema-migrate`
- Set env:
  - `DATABASE_URL=<dokploy postgres connection string>`
- Run it once before the first API deploy
- Re-run it before any deploy that contains schema changes

This service only runs Postgres schema migrations and exits.

### 3. Create `api`

- Build from `Dockerfile.server`
- Domain: `api.<domain>`
- Set env:
  - `DATABASE_URL=<dokploy postgres connection string>`
  - `APP_ORIGIN=https://<domain>`
  - `RUN_SCHEMA_MIGRATIONS_ON_BOOT=0`
  - `PORT=4000`

### 4. Create `client`

- Build from `Dockerfile.client`
- Domain: `<domain>`
- Set env:
  - `MPAD_HTTP_SERVER_ORIGIN=https://api.<domain>`
  - `MPAD_WS_SERVER_ORIGIN=wss://api.<domain>`

### Local Docker Check

Use these before pushing if you want to verify the deploy images and a full local Docker stack:

```sh
bun run docker:build-all
bun run docker:local-up
bun run docker:local-import
bun run docker:local-test
bun run docker:local-down
```

### Deploy Order

First deploy:

1. Run `schema-migrate`
2. Deploy `api`
3. Deploy `client`

Later deploys with schema changes:

1. Run `schema-migrate`
2. Deploy `api`
3. Deploy `client` only if frontend changed

### Verify

- Open `https://api.<domain>/health`
- Open `https://<domain>`
- Create or edit a pad
- Refresh the page and confirm the data is still there

## One-Time Legacy Import

This is separate from normal deployment.

The Turso -> Postgres backfill lives in the `legacy-import` workspace and is only for one-time cutover or manual backfill work. It is not part of normal Dokploy deploys and it is not the same thing as Postgres schema migrations.

Current command:

```sh
bun run legacy:import
```

Use it only when you want to copy legacy Turso data into Postgres.
