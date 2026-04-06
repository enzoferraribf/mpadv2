# mpad Contract

## What this app is

mpad is a real-time pad app.

A pad has:
- markdown text
- one shared drawing surface
- live peer-to-peer files
- related pads from its path tree

No auth. Text and drawing persist. Files do not.

## Repo shape

- `@mpad/core` holds pad primitives, limits, and asserts
- `@mpad/protocol` holds http/ws contracts and codecs
- `@mpad/text-core` holds text-only Yjs restore logic
- `@mpad/testkit` holds shared test fixtures
- `@mpad/server` holds pad-doc, pad-tree, live-file, and transport
- `@mpad/client` holds the pad page shell, feature controllers, and UI

## Server flow

One flow only:

- `http/ws -> transport -> slice service -> repository -> response`

Slices:

- `pad-doc` owns room lifecycle, Yjs sync, awareness, size checks, flush, and compaction
- `pad-tree` owns pad existence and related pad queries
- `live-file` owns text-room file signal relay
- `transport` only parses routes, websocket messages, and delegates

## Client flow

One flow only:

- `route -> usePadPageController -> feature controllers -> dumb UI`

Feature controllers:

- `useTextWorkspace`
- `useDrawingWorkspace`
- `useNavigationTree`
- `useFilesWorkspace`

The page shell owns only layout and dialog state.

## Rules

- Keep code simple and skimmable
- One layer of abstraction per function
- One semantic objective per function
- Prefer discriminated unions
- Use asserts when a value must exist
- Do not make required arguments optional
- Prefer E2E tests for behavior
- Do not let UI code touch raw transport details
