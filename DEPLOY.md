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

Use this only once, before the app writes data into the target Postgres database. The import now requires a fresh Postgres target and aborts if pad data already exists.

### 1. Create a fresh target Postgres database

Create a new Dokploy Postgres database for the cutover and copy its connection string.

### 2. Make sure legacy Turso credentials exist

The importer reads legacy Turso credentials from the repo `.turso` file. It must contain:

- `DATABASE_URL`
- `DATABASE_TOKEN`

### 3. Run the cutover import

Point the importer at the fresh Postgres database:

```sh
TARGET_DATABASE_URL=<dokploy postgres connection string> bun run legacy:import
```

The importer will:

- sync the legacy Turso data into the local sqlite cache
- run the current baseline Postgres migration
- verify the target Postgres pad tables are empty
- import text and drawing docs
- print a JSON summary

### 4. Review the import summary

Check the summary output for imported pad counts and make sure it completed without errors.

### 5. Deploy the app against that same Postgres database

Create the Dokploy app with the same `DATABASE_URL`, plus:

- `APP_ORIGIN=https://<domain>`
- `PORT=4000`
