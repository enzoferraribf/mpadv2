# Deploy

## Normal Deployment

This deploy uses three Dokploy resources:

- one Dokploy Postgres database
- one `api` service
- one `client` service

### 1. Create Postgres

Create a Postgres database in Dokploy and copy its `DATABASE_URL`.

### 2. Create `api`

- Build from `Dockerfile.server`
- Domain: `api.<domain>`
- Set env:
  - `DATABASE_URL=<dokploy postgres connection string>`
  - `APP_ORIGIN=https://<domain>`
  - `RUN_SCHEMA_MIGRATIONS_ON_BOOT=0`
  - `PORT=4000`
- When you need schema migrations, run the same image with command `bun run schema-migrate`
  before deploying the normal API command.

### 3. Create `client`

- Build from `Dockerfile.client`
- Domain: `<domain>`
- Set env:
  - `MPAD_SERVER_ORIGIN=https://api.<domain>`
  - `MPAD_WS_SERVER_ORIGIN=wss://api.<domain>` only if websocket traffic uses a different origin

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

1. Run `bun run schema-migrate` with the server image
2. Deploy `api`
3. Deploy `client`

Later deploys with schema changes:

1. Run `bun run schema-migrate` with the server image
2. Deploy `api`
3. Deploy `client` only if frontend changed

### Verify

- Open `https://api.<domain>/health`
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
