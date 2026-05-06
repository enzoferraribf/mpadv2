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
DASHBOARD_PORT="${MPAD_LOCAL_DASHBOARD_PORT:-13010}"
CLIENT_PORT="${MPAD_LOCAL_CLIENT_PORT:-4174}"
CLIENT_ORIGIN="http://127.0.0.1:${CLIENT_PORT}"
API_ORIGIN="http://127.0.0.1:${APP_PORT}"
DASHBOARD_ORIGIN="http://127.0.0.1:${DASHBOARD_PORT}"
WEB_PREVIEW_PID=""
WEB_PREVIEW_LOG="$ROOT/.tmp/web-preview.log"

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

wait_for_web_preview() {
    attempt=0
    while [ "$attempt" -lt 60 ]; do
        if curl -fsS "$CLIENT_ORIGIN" >/dev/null 2>&1; then
            return 0
        fi
        if [ -n "$WEB_PREVIEW_PID" ] && ! kill -0 "$WEB_PREVIEW_PID" 2>/dev/null; then
            cat "$WEB_PREVIEW_LOG" >&2 || true
            echo "web preview exited before becoming ready" >&2
            exit 1
        fi

        attempt=$((attempt + 1))
        sleep 1
    done

    cat "$WEB_PREVIEW_LOG" >&2 || true
    echo "web preview did not become ready: $CLIENT_ORIGIN" >&2
    exit 1
}

start_web_preview() {
    require_command bun
    mkdir -p "$ROOT/.tmp"
    rm -f "$WEB_PREVIEW_LOG"

    (
        cd "$ROOT/apps/web"
        VITE_E2E=1 VITE_MPAD_API_ORIGIN="$API_ORIGIN" bun run build
        exec env VITE_E2E=1 VITE_MPAD_API_ORIGIN="$API_ORIGIN" bun x vite preview --host 127.0.0.1 --port "$CLIENT_PORT"
    ) >"$WEB_PREVIEW_LOG" 2>&1 &
    WEB_PREVIEW_PID="$!"

    wait_for_web_preview
}

stop_web_preview() {
    if [ -n "$WEB_PREVIEW_PID" ]; then
        kill "$WEB_PREVIEW_PID" >/dev/null 2>&1 || true
        wait "$WEB_PREVIEW_PID" >/dev/null 2>&1 || true
        WEB_PREVIEW_PID=""
    fi
}

up() {
    require_command curl
    require_command docker

    if [ "${RESET_MPAD_LOCAL_DATA:-0}" = "1" ]; then
        compose down --volumes --remove-orphans >/dev/null 2>&1 || true
    fi

    compose up -d --build postgres app dashboard >/dev/null
    wait_for_postgres
    wait_for_http "${API_ORIGIN}/health" app
    wait_for_http "${DASHBOARD_ORIGIN}/api/health" dashboard

    cat <<EOF
Local Docker stack is up.

    API:       ${API_ORIGIN}
    Dashboard: ${DASHBOARD_ORIGIN}
    Client:    ${CLIENT_ORIGIN}
    Postgres:  postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}
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

    app_health="$(curl -fsS "${API_ORIGIN}/health")"
    [ "$app_health" = '{"status":"ok"}' ]
    dashboard_health="$(curl -fsS "${DASHBOARD_ORIGIN}/api/health")"
    [ "$dashboard_health" = '{"status":"ok"}' ]

    related_json="$(curl -fsS "${API_ORIGIN}/api/pads/docker/smoke/related")"
    printf '%s' "$related_json" | grep -F '"/docker"' >/dev/null
    printf '%s' "$related_json" | grep -F '"/docker/smoke"' >/dev/null

    cat <<EOF
Local Docker smoke test passed.

App health: ${app_health}
Dashboard health: ${dashboard_health}
Client origin: ${CLIENT_ORIGIN}
EOF
}

smoke() {
    trap 'stop_web_preview; down || true' EXIT INT TERM

    up
    test_stack
    start_web_preview
    MPAD_PLAYWRIGHT_TARGET=docker \
        DOCKER_SMOKE_PORT="$APP_PORT" \
        E2E_CLIENT_PORT="$CLIENT_PORT" \
        bun x playwright test --config "$ROOT/playwright.config.ts"
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
    smoke)
        smoke
        ;;
    *)
        echo "Usage: $0 {up|down|test|smoke}" >&2
        exit 1
        ;;
esac
