#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

E2E_SERVER_PORT="${E2E_SERVER_PORT:-$("$ROOT/scripts/read-free-port.sh")}"
E2E_CLIENT_PORT="${E2E_CLIENT_PORT:-$("$ROOT/scripts/read-free-port.sh")}"

export E2E_SERVER_PORT
export E2E_CLIENT_PORT

"$ROOT/scripts/docker-test-db.sh" bun x playwright test "$@"
