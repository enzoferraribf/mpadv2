import { createMpadPlaywrightConfig } from './tests/playwright.shared'

export default createMpadPlaywrightConfig({
    grep: /@visual/,
    outputDir: './.tmp/playwright/visual',
    testDir: './tests/e2e',
})
