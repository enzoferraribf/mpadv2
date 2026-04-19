#!/bin/sh
set -eu

: "${MPAD_HTTP_SERVER_ORIGIN:?MPAD_HTTP_SERVER_ORIGIN is required}"
: "${MPAD_WS_SERVER_ORIGIN:?MPAD_WS_SERVER_ORIGIN is required}"

cat > /usr/share/nginx/html/env.js <<EOF
window.__MPAD_CONFIG__ = Object.assign(window.__MPAD_CONFIG__ || {}, {
    httpServerOrigin: "${MPAD_HTTP_SERVER_ORIGIN}",
    wsServerOrigin: "${MPAD_WS_SERVER_ORIGIN}"
})
EOF
