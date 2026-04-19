import {
    expect,
    openPad,
    setLayout,
    test,
    waitForPad,
    waitForText,
    waitForTextHistoryCount,
} from '$/e2e/mpad-test'

test('syncs markdown between two pads', async ({ browser }) => {
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
        () => (window as any).__mpad__?.getText() === '# shared title',
    )
    await expect(
        pageB.getByRole('heading', { name: 'shared title' }),
    ).toBeVisible()

    await contextA.close()
    await contextB.close()
})

test('keeps text after a reload', async ({ browser }) => {
    const path = `notes/${Date.now()}-reload`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await page.evaluate(() =>
        (window as any).__mpad__.appendText('# persisted'),
    )
    await waitForText(page, '# persisted')

    await waitForTextHistoryCount(page, 1)
    await page.reload()
    await waitForPad(page)
    await waitForText(page, '# persisted')
    await setLayout(page, 'Preview')
    await expect(page.getByRole('heading', { name: 'persisted' })).toBeVisible()

    await context.close()
})
