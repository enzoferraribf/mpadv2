import { createMpadPlaywrightConfig } from './playwright.shared'

export default createMpadPlaywrightConfig({
    outputDir: './.tmp/playwright/e2e',
    testDir: './tests/e2e',
})
