import { expect, test } from '@playwright/test'
import { dockerAppUrl } from '../playwright-env'
import { openPad, waitForPad } from './docker-test'

test('serves the docker app with db-backed pads and text persistence', async ({
    page,
}) => {
    const root = `docker-smoke-${Date.now()}`
    const child = `${root}/child`

    await page.goto('/')
    await expect(page.getByTestId('landing-page')).toBeVisible()

    const health = await page.request.get(`${dockerAppUrl}/health`)
    expect(await health.json()).toEqual({ status: 'ok' })

    await openPad(page, root)
    await openPad(page, child)

    const related = await page.request.get(
        `${dockerAppUrl}/api/pads/${child}/related`,
    )
    expect(await related.json()).toEqual([
        { path: `/${root}`, parentPath: null, name: root },
        { path: `/${child}`, parentPath: `/${root}`, name: 'child' },
    ])

    await page.evaluate(() => window.__mpad__.setText('# docker smoke'))
    await page.waitForFunction(
        () => window.__mpad__?.getText() === '# docker smoke',
    )
    await page.waitForTimeout(3_500)
    await page.reload()
    await waitForPad(page)

    await expect
        .poll(() => page.evaluate(() => window.__mpad__?.getText()))
        .toBe('# docker smoke')
})
