import { expect, test } from '@playwright/test'
import { waitForPad } from '../docker-test'

test('opens a pad, saves text, and reloads', async ({ page }) => {
    const path = `docker-smoke-${Date.now()}`

    await page.goto(`/${path}`)
    await waitForPad(page)

    await page.evaluate(() => window.__mpad__.setText('# docker smoke'))
    await page.waitForFunction(
        () => window.__mpad__?.getText() === '# docker smoke',
    )
    await page.getByTitle('Preview only').click()
    await expect(
        page.getByRole('heading', { name: 'docker smoke' }),
    ).toBeVisible()

    await page.waitForTimeout(3_500)
    await page.reload()
    await waitForPad(page)
    await page.getByTitle('Preview only').click()
    await expect
        .poll(() => page.getByRole('heading', { name: 'docker smoke' }).count())
        .toBe(1)
})
