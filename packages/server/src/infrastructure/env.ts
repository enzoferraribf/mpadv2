export type ServerConfig = {
    appOrigin: string | null
    port: number
}

export function readServerConfig(
    env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
    const appOrigin = readOptionalOrigin(env.APP_ORIGIN ?? null)
    if (isProductionEnv(env.NODE_ENV) && appOrigin === null) {
        throw new Error('APP_ORIGIN is required when NODE_ENV=production.')
    }

    return {
        appOrigin,
        port: readPort(env.PORT),
    }
}

export function readDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
    const value = env.DATABASE_URL
    if (!value) {
        throw new Error(
            'Missing DATABASE_URL. Start Postgres and set DATABASE_URL before running the server.',
        )
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

function isProductionEnv(value: string | undefined) {
    return value?.trim() === 'production'
}
