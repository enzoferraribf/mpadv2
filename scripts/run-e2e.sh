#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

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

E2E_SERVER_PORT="${E2E_SERVER_PORT:-$(find_free_port)}"
E2E_CLIENT_PORT="${E2E_CLIENT_PORT:-$(find_free_port)}"

export E2E_SERVER_PORT
export E2E_CLIENT_PORT

"$ROOT/scripts/with-test-db.sh" playwright test
