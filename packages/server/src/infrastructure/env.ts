export type ServerConfig = {
    appOrigin: string | null
    port: number
    runSchemaMigrationsOnBoot: boolean
}

export function readServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
    return {
        appOrigin: readOptionalOrigin(env.APP_ORIGIN ?? null),
        port: readPort(env.PORT),
        runSchemaMigrationsOnBoot: readBoolean(env.RUN_SCHEMA_MIGRATIONS_ON_BOOT, false),
    }
}

export function readDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
    const value = env.DATABASE_URL
    if (!value) {
        throw new Error('Missing DATABASE_URL. Start Postgres and set DATABASE_URL before running the server.')
    }

    return value
}

function readOptionalOrigin(value: string | null) {
    if (!value) return null

    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`APP_ORIGIN must use http or https: ${value}`)
    }

    return url.origin
}

function readPort(value: string | undefined) {
    const port = Number(value ?? 4000)
    if (!Number.isInteger(port) || port <= 0) {
        throw new Error(`Invalid PORT: ${value ?? ''}`)
    }

    return port
}

function readBoolean(value: string | undefined, fallback: boolean) {
    if (value === undefined) return fallback

    const normalized = value.trim().toLowerCase()
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false

    throw new Error(`Invalid boolean value: ${value}`)
}
