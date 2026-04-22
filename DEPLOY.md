# Deploy

## Dokploy

This deploy uses two Dokploy resources:

- one Dokploy Postgres database
- one Dokploy application built from the root `Dockerfile`

### 1. Create Postgres

Create a Postgres database in Dokploy and copy the Postgres connection string the app should use for `DATABASE_URL`.

### 2. Create the app

- Build from the root `Dockerfile`
- Domain: `<domain>`
- Set env:
  - `DATABASE_URL=<dokploy postgres connection string>`
  - `APP_ORIGIN=https://<domain>`
  - `PORT=4000`

The app runs schema migrations on boot automatically. The runtime image sets `NODE_ENV=production` itself.

`APP_ORIGIN` must match the deployed browser origin exactly so CORS and WebSocket origin checks stay same-origin only.

The Bun server serves all of these on the same origin:

- `/health`
- `/api/*`
- `/ws/:roomName`
- built client assets
- SPA fallback routes

### Local Docker Smoke

Run one deploy-shaped smoke pass before pushing:

```sh
bun run docker:smoke
```

### Verify

- Open `https://<domain>/health`
- Open `https://<domain>`
- Create or edit a pad
- Refresh the page and confirm the data is still there

## Turso To Postgres Cutover

This is separate from normal deploys.

The importer runs from your machine. It reads legacy Turso, keeps a local sqlite replica cache inside `tools/tursoimport/.tmp`, and writes into the Postgres database configured in `tools/tursoimport/.env.local`.

It is safe to rerun before cutover. A rerun:

- imports only new or changed text and drawing docs
- appends new revisions only when imported content changed
- ignores pads that disappeared from legacy

Do not use it after live app writes start landing in the same Postgres database.

### 1. Create the importer config

Copy `tools/tursoimport/env.example` to `tools/tursoimport/.env.local` and fill:

- `TURSOIMPORT_TURSO_URL`
- `TURSOIMPORT_TURSO_TOKEN`
- `TURSOIMPORT_TARGET_DATABASE_URL`

Optional keys:

- `TURSOIMPORT_SQLITE_PATH`
- `TURSOIMPORT_REMOTE_PROBE_TIMEOUT_MS`
- `TURSOIMPORT_SYNC_TIMEOUT_MS`

`TURSOIMPORT_TARGET_DATABASE_URL` must be reachable from your laptop.

### 2. Local rehearsal against local Postgres

Bring up the local stack:

```sh
./scripts/docker-local.sh up
```

Set this in `tools/tursoimport/.env.local`:

```sh
TURSOIMPORT_TARGET_DATABASE_URL=postgres://mpad:mpad@127.0.0.1:15432/mpad_local
```

Then run:

```sh
bun run tursoimport
```

### 3. Real cutover into Dokploy Postgres

Create a new Dokploy Postgres database for the cutover and copy its connection string.

Replace `TURSOIMPORT_TARGET_DATABASE_URL` in `tools/tursoimport/.env.local` with the Dokploy Postgres URL your laptop can reach, then run:

```sh
bun run tursoimport
```

If Dokploy shows both an internal and an external Postgres URL, use the one your laptop can reach for this one-time import.

The importer will:

- sync the legacy Turso data into the local sqlite cache
- run the current baseline Postgres migration
- create missing pad rows and pad docs
- append revisions only for changed text and drawing docs
- print a JSON summary

### 4. Review the import summary

Check the summary output and make sure the write counts match what you expect. A no-change rerun should report zero new revisions.

### 5. Deploy the app against the Dokploy Postgres database

Create the Dokploy app with:

- `DATABASE_URL=<dokploy postgres connection string for the app>`
- `APP_ORIGIN=https://<domain>`
- `PORT=4000`

If Dokploy gives you a separate app-side Postgres URL, use that in the app. The one-time import only needs a URL your laptop can reach.
