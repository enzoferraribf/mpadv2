import { defineConfig } from '@playwright/test'

const appPort = Number(process.env.DOCKER_SMOKE_PORT ?? 13000)

export default defineConfig({
    testDir: './tests/docker',
    outputDir: './.tmp/playwright/docker',
    use: {
        baseURL: `http://127.0.0.1:${appPort}`,
        trace: 'retain-on-failure',
    },
})
