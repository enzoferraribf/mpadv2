import { createServer } from './create-server'
import { readServerConfig, type ServerConfig } from '../infrastructure/env'
import { ensureDatabaseReady, migrate } from '../infrastructure/migration-runner'

type StartServerDeps = {
    createServer: typeof createServer
    ensureDatabaseReady: typeof ensureDatabaseReady
    readServerConfig: typeof readServerConfig
    runSchemaMigrations: typeof migrate
}

const defaultDeps: StartServerDeps = {
    createServer,
    ensureDatabaseReady,
    readServerConfig,
    runSchemaMigrations: migrate,
}

export async function startServer(overrides: Partial<StartServerDeps> = {}) {
    const deps = {
        ...defaultDeps,
        ...overrides,
    }
    const config = deps.readServerConfig()

    await prepareServer(config, deps)
    return deps.createServer(config)
}

export async function prepareServer(
    config: ServerConfig,
    deps: Pick<StartServerDeps, 'ensureDatabaseReady' | 'runSchemaMigrations'>,
) {
    if (config.runSchemaMigrationsOnBoot) await deps.runSchemaMigrations()
    await deps.ensureDatabaseReady()
}
