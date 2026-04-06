#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker-compose.test.yml"
PROJECT="${TEST_DB_PROJECT:-mpad-test-$$}"

if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required to run test:server and test:e2e" >&2
    exit 1
fi

cleanup() {
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
}

find_free_port() {
    bun -e "
        import { createServer } from 'node:net'

        const server = createServer()
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            if (!address || typeof address === 'string') process.exit(1)
            console.log(address.port)
            server.close()
        })
    "
}

trap cleanup EXIT INT TERM

cleanup

TEST_DB_PORT="${TEST_DB_PORT:-$(find_free_port)}"
export TEST_DB_PORT
DATABASE_URL="postgres://mpad:mpad@127.0.0.1:${TEST_DB_PORT}/mpad_test"

docker compose -p "$PROJECT" -f "$COMPOSE_FILE" up -d postgres >/dev/null

attempt=0
while [ "$attempt" -lt 60 ]; do
    if docker compose -p "$PROJECT" -f "$COMPOSE_FILE" exec -T postgres pg_isready -U mpad -d mpad_test >/dev/null 2>&1; then
        DATABASE_URL="$DATABASE_URL" "$@"
        exit $?
    fi

    attempt=$((attempt + 1))
    sleep 1
done

echo "test database did not become ready" >&2
exit 1
