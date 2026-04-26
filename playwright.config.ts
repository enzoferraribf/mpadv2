import { defineConfig } from '@playwright/test'
import {
    clientPort,
    clientUrl,
    databaseUrl,
    dockerAppUrl,
    serverPort,
    serverUrl,
} from './tests/playwright-env'

type PlaywrightTarget = 'docker' | 'e2e' | 'visual'
type PlaywrightLane = 'shell' | 'text' | 'drawing' | 'files' | null

const target = readTarget(process.env.MPAD_PLAYWRIGHT_TARGET)
const lane = readLane(process.env.MPAD_PLAYWRIGHT_LANE)

export default defineConfig(createConfig(target, lane))

function createConfig(target: PlaywrightTarget, lane: PlaywrightLane) {
    if (target === 'docker') {
        return {
            testDir: readDockerTestDir(lane),
            outputDir: readDockerOutputDir(lane),
            use: {
                baseURL: clientUrl,
                trace: 'retain-on-failure',
            },
        }
    }

    return {
        testDir: readE2eTestDir(target, lane),
        outputDir: readE2eOutputDir(target, lane),
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
                    'cd apps/api' +
                    ' && PORT=' +
                    serverPort +
                    ' DATABASE_URL=' +
                    databaseUrl +
                    ' CLIENT_ORIGIN=' +
                    clientUrl +
                    ' bun run start',
                port: serverPort,
                reuseExistingServer: false,
                timeout: 120_000,
            },
            {
                command:
                    'cd apps/web' +
                    ' && VITE_E2E=1' +
                    ' VITE_MPAD_API_ORIGIN=' +
                    serverUrl +
                    ' bun x vite --host 127.0.0.1 --port ' +
                    clientPort,
                port: clientPort,
                reuseExistingServer: false,
                timeout: 120_000,
            },
        ],
    }
}

function readDockerTestDir(lane: PlaywrightLane) {
    if (!lane) return './tests/docker'
    return `./tests/docker/${lane}`
}

function readDockerOutputDir(lane: PlaywrightLane) {
    if (!lane) return './.tmp/playwright/docker'
    return `./.tmp/playwright/docker/${lane}`
}

function readE2eTestDir(target: PlaywrightTarget, lane: PlaywrightLane) {
    if (target === 'visual') return './tests/e2e'
    if (!lane) return './tests/e2e'
    return `./tests/e2e/${lane}`
}

function readE2eOutputDir(target: PlaywrightTarget, lane: PlaywrightLane) {
    if (target === 'visual') return './.tmp/playwright/visual'
    if (!lane) return './.tmp/playwright/e2e'
    return `./.tmp/playwright/e2e/${lane}`
}

function readTarget(value: string | undefined): PlaywrightTarget {
    if (!value || value === 'e2e') return 'e2e'
    if (value === 'visual') return 'visual'
    if (value === 'docker') return 'docker'
    throw new Error(`Unsupported MPAD_PLAYWRIGHT_TARGET: ${value}`)
}

function readLane(value: string | undefined): PlaywrightLane {
    if (!value) return null
    if (
        value === 'shell' ||
        value === 'text' ||
        value === 'drawing' ||
        value === 'files'
    ) {
        return value
    }
    throw new Error(`Unsupported MPAD_PLAYWRIGHT_LANE: ${value}`)
}
