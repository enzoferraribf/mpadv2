import { expect, openLanding, openPad, test, waitForPad } from '$/e2e/mpad-test'

test('@visual renders the landing shell in dark media', async ({ page }) => {
    await openLanding(page, { colorScheme: 'dark' })
    await expect(page).toHaveScreenshot('landing-page.png')
})

test('@visual renders the landing shell in light media', async ({ page }) => {
    await openLanding(page, { colorScheme: 'light' })
    await expect(page).toHaveScreenshot('landing-page-light.png')
})

test('opens a pad from the landing input', async ({ page }) => {
    const path = `landing-${Date.now()}`

    await openLanding(page)
    await page.getByLabel('Pad path').fill(path)
    await page.keyboard.press('Enter')
    await waitForPad(page)
    await expect(page).toHaveURL(new RegExp(`/${path}$`))
})
test('shows related pads from the real tree', async ({ browser }) => {
    const root = `docs-${Date.now()}`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, `${root}/two`)
    await openPad(page, `${root}/one/child`)
    await openPad(page, `${root}/branch/start`)
    await page.getByTitle('Toggle sidebar (Ctrl+B)').click()

    await expect
        .poll(async () =>
            page.locator('.pad-explorer .pad-explorer-item').allTextContents(),
        )
        .toContain(`/${root}`)
    await expect
        .poll(async () =>
            page.locator('.pad-explorer .pad-explorer-item').allTextContents(),
        )
        .toContain(`/${root}/two`)
    await expect
        .poll(async () =>
            page.locator('.pad-explorer .pad-explorer-item').allTextContents(),
        )
        .toContain(`/${root}/one/child`)

    await context.close()
})
