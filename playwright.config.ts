import { defineConfig } from '@playwright/test'
import {
    clientPort,
    clientUrl,
    databaseUrl,
    dockerAppUrl,
    serverPort,
} from './tests/playwright-env'

type PlaywrightTarget = 'docker' | 'e2e' | 'visual'

const target = readTarget(process.env.MPAD_PLAYWRIGHT_TARGET)

export default defineConfig(createConfig(target))

function createConfig(target: PlaywrightTarget) {
    if (target === 'docker') {
        return {
            testDir: './tests/docker',
            outputDir: './.tmp/playwright/docker',
            use: {
                baseURL: dockerAppUrl,
                trace: 'retain-on-failure',
            },
        }
    }

    return {
        testDir: './tests/e2e',
        outputDir:
            target === 'visual'
                ? './.tmp/playwright/visual'
                : './.tmp/playwright/e2e',
        grep: target === 'visual' ? /@visual/ : undefined,
        grepInvert: target === 'e2e' ? /@visual/ : undefined,
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
    }
}

function readTarget(value: string | undefined): PlaywrightTarget {
    if (!value || value === 'e2e') return 'e2e'
    if (value === 'visual') return 'visual'
    if (value === 'docker') return 'docker'
    throw new Error(`Unsupported MPAD_PLAYWRIGHT_TARGET: ${value}`)
}
