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