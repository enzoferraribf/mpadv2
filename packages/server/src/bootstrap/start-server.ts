import { createServer } from '#/bootstrap/create-server'
import { createServerRuntime } from '#/bootstrap/runtime'
import { type ServerConfig, readServerConfig } from '#/infrastructure/env'
import { ensureDatabaseReady, migrate } from '#/infrastructure/migration-runner'

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
    const runtime = deps.createServerRuntime()

    await prepareServer(config, deps)
    const server = deps.createServer({
        appOrigin: config.appOrigin,
        port: config.port,
        runtime,
    })

    return {
        runtime,
        server,
    }
}

export async function prepareServer(
    config: ServerConfig,
    deps: Pick<StartServerDeps, 'ensureDatabaseReady' | 'runSchemaMigrations'>,
) {
    if (config.runSchemaMigrationsOnBoot) await deps.runSchemaMigrations()
    await deps.ensureDatabaseReady()
}
