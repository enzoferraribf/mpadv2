import { expect, openLanding, openPad, test, waitForPad } from '$/e2e/mpad-test'

test('opens a pad and shows related pads from the real tree', async ({
    page,
}) => {
    const root = `docs-${Date.now()}`
    const path = `${root}/branch/start`

    await openLanding(page)
    await page.getByLabel('Pad path').fill(path)
    await page.keyboard.press('Enter')
    await waitForPad(page)
    await expect(page).toHaveURL(new RegExp(`/${path}$`))

    await openPad(page, `${root}/two`)
    await openPad(page, `${root}/one/child`)
    await openPad(page, path)
    await page.getByTitle('Toggle sidebar (Ctrl+B)').click()

    await expect
        .poll(async () =>
            page.locator('.pad-explorer .pad-explorer-item').allTextContents(),
        )
        .toEqual(
            expect.arrayContaining([
                `/${root}`,
                `/${root}/two`,
                `/${root}/one/child`,
            ]),
        )
})
