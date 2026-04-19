#!/bin/sh
set -eu

: "${MPAD_SERVER_ORIGIN:?MPAD_SERVER_ORIGIN is required}"

WS_SERVER_ORIGIN="${MPAD_WS_SERVER_ORIGIN:-}"
if [ -z "$WS_SERVER_ORIGIN" ]; then
    case "$MPAD_SERVER_ORIGIN" in
        https://*)
            WS_SERVER_ORIGIN="wss://${MPAD_SERVER_ORIGIN#https://}"
            ;;
        http://*)
            WS_SERVER_ORIGIN="ws://${MPAD_SERVER_ORIGIN#http://}"
            ;;
        *)
            echo "MPAD_SERVER_ORIGIN must start with http:// or https://" >&2
            exit 1
            ;;
    esac
fi

cat > /usr/share/nginx/html/env.js <<EOF
window.__MPAD_CONFIG__ = Object.assign(window.__MPAD_CONFIG__ || {}, {
    serverOrigin: "${MPAD_SERVER_ORIGIN}",
    wsServerOrigin: "${WS_SERVER_ORIGIN}"
})
EOF
