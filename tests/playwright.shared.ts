import { defineConfig } from '@playwright/test'

const databaseUrl =
    process.env.DATABASE_URL ?? 'postgres://mpad:mpad@127.0.0.1:15433/mpad_test'
const serverPort = Number(process.env.E2E_SERVER_PORT ?? 14000)
const clientPort = Number(process.env.E2E_CLIENT_PORT ?? 4174)

export const serverUrl = `http://127.0.0.1:${serverPort}`
export const clientUrl = `http://127.0.0.1:${clientPort}`

type CreatePlaywrightConfigInput = {
    grep?: RegExp
    grepInvert?: RegExp
    outputDir: string
    testDir: string
}

export function createMpadPlaywrightConfig(input: CreatePlaywrightConfigInput) {
    return defineConfig({
        grep: input.grep,
        grepInvert: input.grepInvert,
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
                    ' bun x vite --host 127.0.0.1 --port ' +
                    clientPort,
                port: clientPort,
                reuseExistingServer: false,
                timeout: 120_000,
            },
        ],
    })
}
