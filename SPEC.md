# mpad Architecture Spec

## Overview

`mpad` is a Bun workspace with three apps and shared packages:

- `apps/web`: browser UI for pads.
- `apps/api`: Bun API and WebSocket server.
- `apps/dashboard`: aggregate usage dashboard.
- `packages/core`: shared limits, path parsing, and room naming.
- `packages/protocol`: shared HTTP, WebSocket, and live-file message types.
- `packages/testkit`: test-only helpers.

The browser is static. It talks to the API over HTTP for tree data and WebSocket for real-time rooms. The API stores text and drawing documents in Postgres. File transfer metadata is held in memory and file bytes move peer-to-peer between browsers.

## Runtime Shape

The web app reads `VITE_MPAD_API_ORIGIN` and builds API URLs from it. If unset in development, it falls back to `http://localhost:4000`.

The API exposes:

- `GET /health` for process health.
- `GET /ready` for database readiness.
- `GET /api/pads/:path/related` for related pad discovery.
- `GET /ws/:room?client=:id` as a WebSocket upgrade endpoint.

Room names are built as `/:path:text`, `/:path:drawing`, or `/:path:files`. The API parses the room name, checks origin and client IP policy, applies WebSocket rate limits, then opens the right in-memory room.

The dashboard reads the same Postgres database through `DATABASE_URL`. Its `/api/stats` response is aggregate-only: totals, daily rows, hourly rows, and document mix. It must not return pad paths, root paths, or per-pad tables.

## Pad Features

Markdown uses a Yjs document in a `text` room. CodeMirror edits update the Yjs doc, and remote awareness tracks peer presence and selections.

Drawing uses a separate Yjs document in a `drawing` room. The drawing pane opens its room only when the drawing tab is active.

Files use a `files` room. The server tracks live file awareness and relays WebRTC-style signaling messages. It does not persist file metadata and does not store file bytes.

Related pads are derived from normalized pad paths. A pad path has a root path and an optional parent path. The API returns pads from the same root path, capped by `MAX_RELATED_PADS`.

## Persistence

Postgres stores:

- `pads`: normalized path, root path, parent path, and timestamps.
- `pad_docs`: one row per persisted text or drawing document.
- `pad_revisions`: merged Yjs update chunks, revision numbers, optional snapshots, and timestamps.

When a text or drawing room opens, the API ensures the pad exists, loads the latest checkpoint plus later updates, and rebuilds the Yjs document in memory.

Local updates are collected in memory and flushed after `PERSIST_DEBOUNCE_MS`. The API merges pending Yjs updates into one revision row. Every `CHECKPOINT_INTERVAL` revisions, it stores a full snapshot on that revision so future loads do not need to replay all history.

On socket close, empty text and drawing rooms flush pending updates and are destroyed.

## Docker And Deploy

`apps/api/Dockerfile` is the canonical API image because Dokploy builds from that path. It uses the repo root as build context.

`apps/dashboard/Dockerfile` builds and runs the dashboard.

`compose.local.yml` starts Postgres, API, and dashboard for local Docker checks. `scripts/docker-local.sh` also starts a static web preview for the smoke test.

Dokploy does not use a compose file in this repo. Configure Dokploy to build the API directly from `apps/api/Dockerfile` with repo root as the context. Deploy the dashboard separately from `apps/dashboard/Dockerfile` only if you want the dashboard exposed.

## Limits And Security

The API validates pad paths, room names, client IDs, origins, and trusted client IPs. Production requires `CLIENT_ORIGIN`.

Rate limits cover WebSocket upgrades, active sockets, message count, message bytes, and pad writes. Document and awareness payload sizes are capped in `packages/core/src/pad-limits.ts`.

The web production build writes Cloudflare `_headers` with a content security policy based on `VITE_MPAD_API_ORIGIN`.

The dashboard is intended for aggregate data only. Do not add API fields or UI tables that expose pad names, pad paths, root names, or root paths.
