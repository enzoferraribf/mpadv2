<p align="center">
  <img src="./assets/logo.svg" alt="mpad logo">
</p>

<p align="center">
  <img src="./assets/pad.png" alt="mpad preview">
</p>

<p align="center">
  Real-time pads for markdown, drawing, and related pages.
</p>

## What It Is

`mpad` is a small real-time pad app. Open a path like `/notes/demo` and start working. There is no auth flow, workspace setup, or page creation step.

A pad has:

- shared markdown with persisted reloads
- one shared drawing surface
- related pad discovery from the same path tree
- an aggregate dashboard for usage stats

## Local Development

Install dependencies:

```sh
bun install
```

Create `.env` from `.env.example`:

```sh
DATABASE_URL=postgres://mpad:mpad@127.0.0.1:15432/mpad_local
PORT=4000
CLIENT_ORIGIN=http://127.0.0.1:5173
CLIENT_IP_SOURCE=direct
TRUST_PROXY_HEADERS=false
VITE_MPAD_API_ORIGIN=http://127.0.0.1:4000
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=4010
DASHBOARD_TIME_ZONE=Europe/London
```

Start Postgres, then run:

```sh
bun dev
```

The web app runs on Vite's default port and the API runs on `PORT`.

Run the dashboard locally with the same `DATABASE_URL`:

```sh
bun run --cwd apps/dashboard dev
```

## Docker

The API Dockerfile is `apps/api/Dockerfile`. Dokploy should build the API with:

- context: `.`
- dockerfile: `apps/api/Dockerfile`

The dashboard Dockerfile is `apps/dashboard/Dockerfile`. Deploy it separately if you want dashboard access. The repo has no Dokploy compose file.

For a deploy-shaped local smoke pass:

```sh
bun run docker:smoke
```

That command starts Postgres, API, dashboard, builds the web app with `VITE_MPAD_API_ORIGIN` pointed at the Docker API, serves the static web app, and runs the Docker Playwright smoke test.

Default local Docker ports:

- API: `http://127.0.0.1:13000`
- dashboard: `http://127.0.0.1:13010`
- web preview: `http://127.0.0.1:4174`
- Postgres: `127.0.0.1:15432`

## Checks

```sh
bun run check
bun run test
bun run docker:smoke
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT. See [LICENSE](./LICENSE).

See [SPEC.md](./SPEC.md) for the architecture and feature details.
