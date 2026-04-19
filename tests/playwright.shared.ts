import { defineConfig } from '@playwright/test'

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://localhost:5432/mpad'
const serverPort = Number(process.env.E2E_SERVER_PORT ?? 4000)
const clientPort = Number(process.env.E2E_CLIENT_PORT ?? 4173)

export const serverUrl = `http://127.0.0.1:${serverPort}`
export const clientUrl = `http://127.0.0.1:${clientPort}`

type CreatePlaywrightConfigInput = {
    outputDir: string
    testDir: string
}

export function createMpadPlaywrightConfig(input: CreatePlaywrightConfigInput) {
    return defineConfig({
        testDir: input.testDir,
        outputDir: input.outputDir,
        fullyParallel: false,
        use: {
            baseURL: clientUrl,
            trace: 'retain-on-failure',
        },
        webServer: [
            {
                command:
                    'cd packages/server' +
                    ' && DATABASE_URL=' +
                    databaseUrl +
                    ' bun run schema-migrate' +
                    ' && PORT=' +
                    serverPort +
                    ' DATABASE_URL=' +
                    databaseUrl +
                    ' bun run start',
                port: serverPort,
                reuseExistingServer: false,
                timeout: 120_000,
            },
            {
                command:
                    'cd packages/client' +
                    ' && VITE_E2E=1' +
                    ' VITE_SERVER_ORIGIN=' +
                    serverUrl +
                    ' bun run build' +
                    ' && bun run preview -- --port ' +
                    clientPort,
                port: clientPort,
                reuseExistingServer: false,
                timeout: 120_000,
            },
        ],
    })
}
