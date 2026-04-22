const defaultDatabaseUrl = 'postgres://mpad:mpad@127.0.0.1:15433/mpad_test'

export const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl
export const serverPort = Number(process.env.E2E_SERVER_PORT ?? 14000)
export const clientPort = Number(process.env.E2E_CLIENT_PORT ?? 4174)
export const dockerAppPort = Number(process.env.DOCKER_SMOKE_PORT ?? 13000)

export const serverUrl = `http://127.0.0.1:${serverPort}`
export const clientUrl = `http://127.0.0.1:${clientPort}`
export const dockerAppUrl = `http://127.0.0.1:${dockerAppPort}`
