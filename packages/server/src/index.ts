import { shutdownServer } from './bootstrap/create-server'
import { startServer } from './bootstrap/start-server'

const server = await startServer()
let shuttingDown = false

async function shutdown() {
    if (shuttingDown) return
    shuttingDown = true
    await shutdownServer()
    server.stop(true)
    process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
