import { defineConfig } from '@playwright/test'

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://localhost:5432/mpad'
const serverPort = Number(process.env.E2E_SERVER_PORT ?? 4000)
const clientPort = Number(process.env.E2E_CLIENT_PORT ?? 4173)
const serverUrl = `http://127.0.0.1:${serverPort}`
const clientUrl = `http://127.0.0.1:${clientPort}`

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    use: {
        baseURL: clientUrl,
        trace: 'retain-on-failure',
    },
    webServer: [
        {
            command: 'cd packages/server && PORT=' + serverPort + ' DATABASE_URL=' + databaseUrl + ' bun run start',
            port: serverPort,
            reuseExistingServer: false,
            timeout: 120_000,
        },
        {
            command:
                'cd packages/client'
                + ' && VITE_E2E=1'
                + ' VITE_API_URL=' + serverUrl
                + ' VITE_WS_URL=ws://127.0.0.1:' + serverPort
                + ' bun run build'
                + ' && bun run preview -- --port ' + clientPort,
            port: clientPort,
            reuseExistingServer: false,
            timeout: 120_000,
        },
    ],
})
