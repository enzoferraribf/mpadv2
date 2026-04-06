import { ensureDatabaseReady } from './infrastructure/migration-runner'
import { createServer, shutdownServer } from './bootstrap/create-server'

const PORT = Number(process.env.PORT ?? 4000)

await ensureDatabaseReady()

createServer(PORT)

async function shutdown() {
    await shutdownServer()
    process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
