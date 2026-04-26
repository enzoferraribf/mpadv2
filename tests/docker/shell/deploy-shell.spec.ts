import { expect, test } from '@playwright/test'
import { dockerAppUrl } from '../../playwright-env'
import { openPad } from '../docker-test'

test('serves landing, health, and related pads from the docker app', async ({
    page,
}) => {
    const root = `docker-shell-${Date.now()}`
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
    expect(related.ok()).toBe(true)
    expect(await related.json()).toEqual([
        { path: `/${root}`, parentPath: null, name: root },
        { path: `/${child}`, parentPath: `/${root}`, name: 'child' },
    ])
})
