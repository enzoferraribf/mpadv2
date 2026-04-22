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

- Real-time markdown editing with persisted history
- One shared drawing surface per pad
- Live peer-to-peer file transfer inside the room
- Related pad discovery from the current path tree
- Same-origin HTTP and WebSocket transport

## Repo layout

- `packages/client`: pad page shell, feature controllers, UI
- `packages/server`: transport, pad-doc, pad-tree, live-file
- `packages/core`: shared pad primitives and limits
- `packages/protocol`: HTTP and WebSocket contracts
- `packages/text-core`: text-only Yjs restore logic
- `packages/testkit`: shared test fixtures
- `tools/tursoimport`: one-time legacy Turso to Postgres import tool

## Development

Install dependencies:

```sh
bun install
```

Create a local `.env` at the repo root:

```sh
DATABASE_URL=postgres://mpad:mpad@127.0.0.1:55432/mpad_test
PORT=4000
# APP_ORIGIN=https://app.example.com
```

Start the app:

```sh
bun dev
```

The client and server run through Turborepo. For a deploy-shaped local smoke pass, use:

```sh
bun run docker:smoke
```

## Checks

Run the full repo check:

```sh
bun run check
```

Run tests:

```sh
bun test
```

Run Playwright smoke:

```sh
bun run smoke
```

## Deploy

The production deploy uses:

- one Postgres database
- one app built from the root `Dockerfile`

Set these env vars in the deployed app:

```sh
DATABASE_URL=<postgres connection string>
APP_ORIGIN=https://<domain>
PORT=4000
```

`APP_ORIGIN` must match the browser origin exactly.

For the full deploy and cutover notes, see [DEPLOY.md](./DEPLOY.md).
