import { ensureDatabaseReady, migrate } from '#/db/migrate'
import { readServerConfig } from '#/platform/env'
import { createServer } from '#/platform/http/server'
import { createServerRuntime } from '#/platform/runtime/runtime'

type StartServerDeps = {
    createServer: typeof createServer
    createServerRuntime: typeof createServerRuntime
    ensureDatabaseReady: typeof ensureDatabaseReady
    readServerConfig: typeof readServerConfig
    runSchemaMigrations: typeof migrate
}

const defaultDeps: StartServerDeps = {
    createServer,
    createServerRuntime,
    ensureDatabaseReady,
    readServerConfig,
    runSchemaMigrations: migrate,
}

export async function startServer() {
    return startServerWithDeps(defaultDeps)
}

export async function startServerWithDeps(deps: StartServerDeps) {
    const config = deps.readServerConfig()
    const runtime = deps.createServerRuntime(config.limits)

    await prepareServer(deps)
    const server = deps.createServer({
        clientIp: config.clientIp,
        clientOrigin: config.clientOrigin,
        port: config.port,
        runtime,
    })

    return {
        runtime,
        server,
    }
}

export async function prepareServer(
    deps: Pick<StartServerDeps, 'ensureDatabaseReady' | 'runSchemaMigrations'>,
) {
    await deps.runSchemaMigrations()
    await deps.ensureDatabaseReady()
}
