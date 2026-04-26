import { shutdownServer } from '#/platform/http/server'
import { startServer } from '#/platform/http/start'

const started = await startServer()
let shuttingDown = false

async function shutdown() {
    if (shuttingDown) return
    shuttingDown = true
    await shutdownServer(started.runtime)
    started.server.stop(true)
    process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
