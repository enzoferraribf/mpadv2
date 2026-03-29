#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker-compose.test.yml"
PROJECT="mmpad-test"
DATABASE_URL="postgres://mmpad:mmpad@127.0.0.1:55432/mmpad_test"

if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required to run test:server and test:e2e" >&2
    exit 1
fi

cleanup() {
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

docker compose -p "$PROJECT" -f "$COMPOSE_FILE" up -d postgres >/dev/null

attempt=0
while [ "$attempt" -lt 60 ]; do
    if docker compose -p "$PROJECT" -f "$COMPOSE_FILE" exec -T postgres pg_isready -U mmpad -d mmpad_test >/dev/null 2>&1; then
        DATABASE_URL="$DATABASE_URL" "$@"
        exit $?
    fi

    attempt=$((attempt + 1))
    sleep 1
done

echo "test database did not become ready" >&2
exit 1
