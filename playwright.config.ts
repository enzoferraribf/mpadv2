import { defineConfig } from '@playwright/test'

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://localhost:5432/mmpad'

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure',
    },
    webServer: [
        {
            command: 'cd packages/server && PORT=4000 DATABASE_URL=' + databaseUrl + ' bun run start',
            port: 4000,
            reuseExistingServer: true,
            timeout: 120_000,
        },
        {
            command: 'cd packages/client && VITE_E2E=1 VITE_API_URL=http://127.0.0.1:4000 VITE_WS_URL=ws://127.0.0.1:4000 bun run build && bun run preview',
            port: 4173,
            reuseExistingServer: true,
            timeout: 120_000,
        },
    ],
})
