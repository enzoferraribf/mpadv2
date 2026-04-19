#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

NETWORK="${MPAD_LOCAL_DOCKER_NETWORK:-mpad-local}"
POSTGRES_CONTAINER="${MPAD_LOCAL_POSTGRES_CONTAINER:-mpad-local-postgres}"
API_CONTAINER="${MPAD_LOCAL_API_CONTAINER:-mpad-local-api}"
CLIENT_CONTAINER="${MPAD_LOCAL_CLIENT_CONTAINER:-mpad-local-client}"
POSTGRES_VOLUME="${MPAD_LOCAL_POSTGRES_VOLUME:-mpad-local-postgres-data}"

POSTGRES_DB="${MPAD_LOCAL_POSTGRES_DB:-mpad_local}"
POSTGRES_USER="${MPAD_LOCAL_POSTGRES_USER:-mpad}"
POSTGRES_PASSWORD="${MPAD_LOCAL_POSTGRES_PASSWORD:-mpad}"

POSTGRES_PORT="${MPAD_LOCAL_POSTGRES_PORT:-15432}"
API_PORT="${MPAD_LOCAL_API_PORT:-14000}"
CLIENT_PORT="${MPAD_LOCAL_CLIENT_PORT:-13000}"

APP_ORIGIN="http://127.0.0.1:${CLIENT_PORT}"
HTTP_SERVER_ORIGIN="http://127.0.0.1:${API_PORT}"
WS_SERVER_ORIGIN="ws://127.0.0.1:${API_PORT}"
DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_CONTAINER}:5432/${POSTGRES_DB}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "$1 is required" >&2
        exit 1
    fi
}

ensure_images() {
    if [ "${FORCE_DOCKER_BUILD:-0}" = "1" ] || ! docker image inspect mpad-client mpad-server mpad-schema-migrate >/dev/null 2>&1; then
        (cd "$ROOT" && bun run docker:build-all)
    fi
}

ensure_network() {
    if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
        docker network create "$NETWORK" >/dev/null
    fi
}

ensure_volume() {
    if ! docker volume inspect "$POSTGRES_VOLUME" >/dev/null 2>&1; then
        docker volume create "$POSTGRES_VOLUME" >/dev/null
    fi
}

remove_containers() {
    docker rm -f "$CLIENT_CONTAINER" "$API_CONTAINER" "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
}

wait_for_postgres() {
    attempt=0
    while [ "$attempt" -lt 60 ]; do
        if docker exec "$POSTGRES_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 1
    done

    docker logs "$POSTGRES_CONTAINER" >&2 || true
    echo "postgres did not become ready" >&2
    exit 1
}

wait_for_http() {
    url="$1"
    container="$2"
    attempt=0
    while [ "$attempt" -lt 60 ]; do
        if curl -fsS "$url" >/dev/null 2>&1; then
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 1
    done

    docker logs "$container" >&2 || true
    echo "service did not become ready: $url" >&2
    exit 1
}

up() {
    require_command bun
    require_command curl
    require_command docker

    if [ "${RESET_MPAD_LOCAL_DATA:-0}" = "1" ]; then
        remove_containers
        docker volume rm "$POSTGRES_VOLUME" >/dev/null 2>&1 || true
    else
        remove_containers
    fi

    ensure_images
    ensure_network
    ensure_volume

    docker run -d \
        --name "$POSTGRES_CONTAINER" \
        --network "$NETWORK" \
        -p "${POSTGRES_PORT}:5432" \
        -e POSTGRES_DB="$POSTGRES_DB" \
        -e POSTGRES_USER="$POSTGRES_USER" \
        -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        -v "$POSTGRES_VOLUME:/var/lib/postgresql/data" \
        postgres:16-alpine \
        >/dev/null
    wait_for_postgres

    docker run --rm \
        --network "$NETWORK" \
        -e DATABASE_URL="$DATABASE_URL" \
        mpad-schema-migrate \
        >/dev/null

    docker run -d \
        --name "$API_CONTAINER" \
        --network "$NETWORK" \
        -p "${API_PORT}:4000" \
        -e DATABASE_URL="$DATABASE_URL" \
        -e APP_ORIGIN="$APP_ORIGIN" \
        -e PORT=4000 \
        -e RUN_SCHEMA_MIGRATIONS_ON_BOOT=0 \
        mpad-server \
        >/dev/null
    wait_for_http "http://127.0.0.1:${API_PORT}/health" "$API_CONTAINER"

    docker run -d \
        --name "$CLIENT_CONTAINER" \
        --network "$NETWORK" \
        -p "${CLIENT_PORT}:80" \
        -e MPAD_HTTP_SERVER_ORIGIN="$HTTP_SERVER_ORIGIN" \
        -e MPAD_WS_SERVER_ORIGIN="$WS_SERVER_ORIGIN" \
        mpad-client \
        >/dev/null
    wait_for_http "http://127.0.0.1:${CLIENT_PORT}/env.js" "$CLIENT_CONTAINER"

    cat <<EOF
Local Docker stack is up.

Client:   http://127.0.0.1:${CLIENT_PORT}
API:      http://127.0.0.1:${API_PORT}
Postgres: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}

Containers:
- ${POSTGRES_CONTAINER}
- ${API_CONTAINER}
- ${CLIENT_CONTAINER}
EOF
}

down() {
    require_command docker

    remove_containers
    docker network rm "$NETWORK" >/dev/null 2>&1 || true

    if [ "${REMOVE_MPAD_LOCAL_VOLUME:-0}" = "1" ]; then
        docker volume rm "$POSTGRES_VOLUME" >/dev/null 2>&1 || true
    fi
}

import_legacy() {
    require_command bun

    (
        cd "$ROOT"
        TARGET_DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}" \
            bun run legacy:import
    )
}

test_stack() {
    require_command curl

    api_health="$(curl -fsS "http://127.0.0.1:${API_PORT}/health")"
    [ "$api_health" = '{"status":"ok"}' ]

    cors_origin="$(
        curl -fsSI \
            -H "Origin: ${APP_ORIGIN}" \
            "http://127.0.0.1:${API_PORT}/health" \
            | tr -d '\r' \
            | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}'
    )"
    [ "$cors_origin" = "$APP_ORIGIN" ]

    env_js="$(curl -fsS "http://127.0.0.1:${CLIENT_PORT}/env.js")"
    printf '%s' "$env_js" | grep -F "httpServerOrigin: \"${HTTP_SERVER_ORIGIN}\"" >/dev/null
    printf '%s' "$env_js" | grep -F "wsServerOrigin: \"${WS_SERVER_ORIGIN}\"" >/dev/null

    landing_html="$(curl -fsS "http://127.0.0.1:${CLIENT_PORT}/docker-smoke")"
    printf '%s' "$landing_html" | grep -F '<title>Mpad</title>' >/dev/null

    related_json="$(curl -fsS "http://127.0.0.1:${API_PORT}/api/pads/docker/smoke/related")"
    printf '%s' "$related_json" | grep -F '"/docker"' >/dev/null
    printf '%s' "$related_json" | grep -F '"/docker/smoke"' >/dev/null

    cat <<EOF
Local Docker smoke test passed.

API health: ${api_health}
CORS origin: ${cors_origin}
EOF
}

case "${1:-}" in
    up)
        up
        ;;
    down)
        down
        ;;
    import)
        import_legacy
        ;;
    test)
        test_stack
        ;;
    *)
        echo "Usage: $0 {up|down|import|test}" >&2
        exit 1
        ;;
esac
