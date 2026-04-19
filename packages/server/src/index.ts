import { shutdownServer } from '#/bootstrap/create-server'
import { startServer } from '#/bootstrap/start-server'

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
