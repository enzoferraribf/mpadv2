import { expect, test } from '@playwright/test'

test('opens a pad, saves text, and reloads', async ({ page }) => {
    const path = `docker-smoke-${Date.now()}`

    await page.goto(`/${path}`)
    await waitForPad(page)

    await page.getByLabel('Pad text editor').click()
    await page.keyboard.type('# docker smoke')
    await page.getByTitle('Preview only').click()
    await expect(
        page.getByRole('heading', { name: 'docker smoke' }),
    ).toBeVisible()

    await page.reload()
    await waitForPad(page)
    await page.getByTitle('Preview only').click()
    await expect
        .poll(() => page.getByRole('heading', { name: 'docker smoke' }).count())
        .toBe(1)
})

async function waitForPad(page: import('@playwright/test').Page) {
    await expect(page.getByLabel('Pad text editor')).toBeVisible()
}
