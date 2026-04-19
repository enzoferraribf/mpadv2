#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

COMPOSE_FILE="${MPAD_LOCAL_COMPOSE_FILE:-compose.local.yml}"
PROJECT_NAME="${MPAD_LOCAL_DOCKER_PROJECT:-mpad-local}"
POSTGRES_DB="${MPAD_LOCAL_POSTGRES_DB:-mpad_local}"
POSTGRES_USER="${MPAD_LOCAL_POSTGRES_USER:-mpad}"
POSTGRES_PASSWORD="${MPAD_LOCAL_POSTGRES_PASSWORD:-mpad}"
POSTGRES_PORT="${MPAD_LOCAL_POSTGRES_PORT:-15432}"
APP_PORT="${MPAD_LOCAL_APP_PORT:-13000}"
APP_ORIGIN="http://127.0.0.1:${APP_PORT}"
DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "$1 is required" >&2
        exit 1
    fi
}

compose() {
    docker compose \
        --file "$ROOT/$COMPOSE_FILE" \
        --project-name "$PROJECT_NAME" \
        "$@"
}

wait_for_postgres() {
    attempt=0
    while [ "$attempt" -lt 60 ]; do
        if compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 1
    done

    compose logs postgres >&2 || true
    echo "postgres did not become ready" >&2
    exit 1
}

wait_for_http() {
    url="$1"
    service="$2"
    attempt=0
    while [ "$attempt" -lt 60 ]; do
        if curl -fsS "$url" >/dev/null 2>&1; then
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 1
    done

    compose logs "$service" >&2 || true
    echo "service did not become ready: $url" >&2
    exit 1
}

up() {
    require_command curl
    require_command docker

    if [ "${RESET_MPAD_LOCAL_DATA:-0}" = "1" ]; then
        compose down --volumes --remove-orphans >/dev/null 2>&1 || true
    fi

    compose up -d --build postgres app >/dev/null
    wait_for_postgres
    wait_for_http "http://127.0.0.1:${APP_PORT}/health" app

    cat <<EOF
Local Docker stack is up.

App:      http://127.0.0.1:${APP_PORT}
Postgres: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}
EOF
}

down() {
    require_command docker

    if [ "${REMOVE_MPAD_LOCAL_VOLUME:-0}" = "1" ]; then
        compose down --volumes --remove-orphans >/dev/null
        return
    fi

    compose down --remove-orphans >/dev/null
}

test_stack() {
    require_command curl

    app_health="$(curl -fsS "http://127.0.0.1:${APP_PORT}/health")"
    [ "$app_health" = '{"status":"ok"}' ]

    landing_html="$(curl -fsS "http://127.0.0.1:${APP_PORT}/docker-smoke")"
    printf '%s' "$landing_html" | grep -F '<title>Mpad</title>' >/dev/null

    related_json="$(curl -fsS "http://127.0.0.1:${APP_PORT}/api/pads/docker/smoke/related")"
    printf '%s' "$related_json" | grep -F '"/docker"' >/dev/null
    printf '%s' "$related_json" | grep -F '"/docker/smoke"' >/dev/null

    cat <<EOF
Local Docker smoke test passed.

App health: ${app_health}
App origin: ${APP_ORIGIN}
EOF
}

case "${1:-}" in
    up)
        up
        ;;
    down)
        down
        ;;
    test)
        test_stack
        ;;
    *)
        echo "Usage: $0 {up|down|test}" >&2
        exit 1
        ;;
esac
