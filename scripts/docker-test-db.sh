#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CONTAINER="${TEST_DB_CONTAINER:-mpad-test-db-$$}"
TEST_DB_PORT="${TEST_DB_PORT:-15433}"
DATABASE_URL="postgres://mpad:mpad@127.0.0.1:${TEST_DB_PORT}/mpad_test"

if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required to run bun run test and bun run smoke" >&2
    exit 1
fi

cleanup() {
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

cleanup

docker run -d \
    --rm \
    --name "$CONTAINER" \
    -e POSTGRES_DB=mpad_test \
    -e POSTGRES_USER=mpad \
    -e POSTGRES_PASSWORD=mpad \
    -p "${TEST_DB_PORT}:5432" \
    --tmpfs /var/lib/postgresql/data \
    postgres:16-alpine \
    >/dev/null

attempt=0
while [ "$attempt" -lt 60 ]; do
    if docker exec "$CONTAINER" pg_isready -U mpad -d mpad_test >/dev/null 2>&1; then
        export TEST_DB_PORT
        export DATABASE_URL
        "$@"
        exit $?
    fi

    attempt=$((attempt + 1))
    sleep 1
done

docker logs "$CONTAINER" >&2 || true
echo "test database did not become ready" >&2
exit 1
