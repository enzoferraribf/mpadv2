#!/usr/bin/env sh
set -eu

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
