import {
    expect,
    openPad,
    setLayout,
    test,
    waitForPad,
    waitForText,
    waitForTextPersistence,
} from '$/e2e/mpad-test'

test('syncs markdown between peers and persists after reload', async ({
    browser,
}) => {
    const path = `notes/${Date.now()}-text`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)
    await setLayout(pageB, 'Preview')

    await pageA.locator('.cm-content').first().click()
    await pageA.keyboard.type('# shared title')

    await pageB.waitForFunction(
        () => window.__mpad__?.getText() === '# shared title',
    )
    await expect(
        pageB.getByRole('heading', { name: 'shared title' }),
    ).toBeVisible()

    await waitForTextPersistence(pageB)
    await pageB.reload()
    await waitForPad(pageB)
    await waitForText(pageB, '# shared title')
    await setLayout(pageB, 'Preview')
    await expect(
        pageB.getByRole('heading', { name: 'shared title' }),
    ).toBeVisible()

    await contextA.close()
    await contextB.close()
})

test('exports the current markdown through the print flow', async ({
    page,
}) => {
    const path = `notes/${Date.now()}-pdf`

    await page.addInitScript(() => {
        window.print = () => {
            ;(
                window as unknown as {
                    __mpadPrintCalled?: boolean
                }
            ).__mpadPrintCalled = true
        }
    })
    await openPad(page, path)
    await page.evaluate(() =>
        window.__mpad__.setText('# Exported\n\n```ts\nconst value = 1\n```'),
    )
    await waitForText(page, '# Exported\n\n```ts\nconst value = 1\n```')
    await page.getByLabel('Export PDF').click()

    await expect(page.locator('.markdown-pdf-export')).toContainText('Exported')
    await page.waitForFunction(
        () =>
            (
                window as unknown as {
                    __mpadPrintCalled?: boolean
                }
            ).__mpadPrintCalled === true,
    )
})
