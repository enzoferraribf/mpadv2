<p align="center">
  <img src="./assets/logo.svg" alt="mpad logo">
</p>

<p align="center">
  <img src="./assets/pad.png" alt="mpad preview">
</p>

<p align="center">
  Real-time pads for markdown, drawing, live files, and related pages
</p>

<br>

`mpad` is a real-time pad app.

Open any path and start working. There is no auth flow, no workspace setup, and no page creation step. A pad gives you shared markdown, one shared drawing surface, live peer-to-peer files, and related pads from the same path tree.

## What it does

- Real-time markdown editing with persisted reloads
- One shared drawing surface per pad
- Live peer-to-peer file transfer inside the room
- Related pad discovery from the current path tree
- Static client on the browser host with API and WebSocket transport on the API host

## Repo shape

- `apps/web` owns React, routes, browser realtime, UI state, and styles.
- `apps/api` owns Bun HTTP, WebSocket handling, environment parsing, database access, migrations, and server-side feature code.
- `packages/core` owns pure pad primitives, limits, asserts, path helpers, and room helpers.
- `packages/protocol` owns HTTP DTOs, WebSocket messages, peer/file types, and boundary schemas.
- `packages/testkit` owns shared test fixtures.
- `tools` owns standalone local tools.

Browser code must not import API code. API code must not import web code. Packages must not import app code or browser UI packages.

## Development

Install dependencies:

```sh
bun install
```

Create a local `.env` at the repo root:

```sh
DATABASE_URL=postgres://mpad:mpad@127.0.0.1:15432/mpad_local
PORT=4000
CLIENT_ORIGIN=http://127.0.0.1:4174
CLIENT_IP_SOURCE=direct
TRUST_PROXY_HEADERS=false
VITE_MPAD_API_ORIGIN=http://127.0.0.1:4000
```

Start the app:

```sh
bun dev
```

The web app and API run through Bun workspaces. For a deploy-shaped local smoke pass, use:

```sh
bun run docker:smoke
```

That command builds the static web app with `VITE_MPAD_API_ORIGIN` pointed at
the Docker API, serves the built files locally, and runs the Docker smoke lanes
against that split shape.

## Checks

Run the full repo check:

```sh
bun run check
```

Run tests:

```sh
bun run test
```

Run Playwright smoke:

```sh
bun run smoke
```

Run a local production build:

```sh
bun run build:local
```

## Deploy

The production deploy uses:

- one Postgres database
- one static client built from `apps/web`
- one API server built from the root `Dockerfile`

`bun run build` intentionally requires `VITE_MPAD_API_ORIGIN`; the built client
has the API and WebSocket origin baked in.

Build the client with:

```sh
VITE_MPAD_API_ORIGIN=https://api.<domain> bun run --cwd apps/web build
```

Set these env vars in the deployed server:

```sh
DATABASE_URL=<postgres connection string>
CLIENT_ORIGIN=https://<domain>
CLIENT_IP_SOURCE=cloudflare
TRUST_PROXY_HEADERS=false
PORT=4000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_WS_UPGRADES=60
MAX_ROOM_CLIENTS=32
MAX_RELATED_PADS=100
```

`CLIENT_ORIGIN` must match the browser origin exactly. With Cloudflare in
front, keep `CLIENT_IP_SOURCE=cloudflare` and keep the origin unreachable
directly, otherwise IP headers can be spoofed.

For Dokploy, prefer `compose.dokploy.yml`. It exposes the API only to the
Dokploy/Traefik network and keeps Postgres on an internal Docker network. Route
only the API domain through Dokploy Domains, and do not publish ports `4000` or
`5432` on the Hetzner firewall.

`tools/tursoimport` is a migration-only helper for importing legacy pad data.
It is kept in the main test suite, but it is not part of the deployed app.

Before launch:

- Allow inbound `80` and `443` on Hetzner.
- Restrict `22` to your IP.
- Keep `4000` and `5432` closed.
- Configure Dokploy Postgres backups to S3 and test a restore.
