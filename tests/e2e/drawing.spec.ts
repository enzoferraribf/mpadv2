import {
    expect,
    moveDrawingPointer,
    openDrawingRoom,
    openPad,
    test,
    waitForPad,
} from '$/e2e/mpad-test'

test('syncs the drawing surface between two pads', async ({ browser }) => {
    const path = `notes/${Date.now()}-drawing`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await openDrawingRoom(pageA)
    await openDrawingRoom(pageB)

    await pageA.evaluate(() => (window as any).__mpad__.insertTestRectangle())
    await pageB.waitForFunction(
        () => (window as any).__mpad__?.getDrawingElementCount() === 1,
    )

    await contextA.close()
    await contextB.close()
})

test('persists a local Excalidraw arrow change', async ({ browser }) => {
    const path = `notes/${Date.now()}-drawing-persist`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await openDrawingRoom(page)
    await page.evaluate(() => (window as any).__mpad__.insertTestArrow())
    await moveDrawingPointer(page)
    await expect
        .poll(async () =>
            page.evaluate(
                () => (window as any).__mpad__?.getDrawingElementCount() ?? -1,
            ),
        )
        .toBe(1)

    await page.waitForTimeout(250)
    await expect
        .poll(async () =>
            page.evaluate(
                () => (window as any).__mpad__?.getDrawingElementCount() ?? -1,
            ),
        )
        .toBe(1)

    await page.reload()
    await waitForPad(page)
    await openDrawingRoom(page)
    await expect
        .poll(async () =>
            page.evaluate(
                () => (window as any).__mpad__?.getDrawingElementCount() ?? -1,
            ),
        )
        .toBe(1)

    await context.close()
})

test('renders the drawing workspace', async ({ browser }) => {
    const path = 'visuals/drawing-workspace'
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path, { colorScheme: 'dark' })
    await openDrawingRoom(page)
    await expect(page.getByTestId('workspace-shell')).toHaveScreenshot(
        'drawing-workspace.png',
        { maxDiffPixels: 600 },
    )

    await context.close()
})

test('keeps match app dark in both palettes and preserves explicit drawing themes', async ({
    browser,
}) => {
    const darkContext = await browser.newContext()
    const darkPage = await darkContext.newPage()

    await openPad(darkPage, `notes/${Date.now()}-drawing-theme-dark`, {
        colorScheme: 'dark',
    })
    await openDrawingRoom(darkPage)
    await expect.poll(() => readExcalidrawTheme(darkPage)).toBe('dark')

    await darkContext.close()

    const lightContext = await browser.newContext()
    const lightPage = await lightContext.newPage()

    await openPad(lightPage, `notes/${Date.now()}-drawing-theme-light`, {
        colorScheme: 'light',
    })
    await openDrawingRoom(lightPage)
    await expect.poll(() => readExcalidrawTheme(lightPage)).toBe('dark')

    await lightPage.getByLabel('Drawing settings').click()
    await lightPage.getByRole('radio', { name: /Light/ }).click()
    await expect.poll(() => readExcalidrawTheme(lightPage)).toBe('light')

    await lightPage.getByRole('radio', { name: /Dark/ }).click()
    await expect.poll(() => readExcalidrawTheme(lightPage)).toBe('dark')

    await lightContext.close()
})

test('opens the drawing workspace from the command menu', async ({
    browser,
}) => {
    const path = `notes/${Date.now()}-drawing-menu`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)

    await page.keyboard.press('Control+,')
    await page
        .getByRole('dialog')
        .getByText('Excalidraw', { exact: true })
        .click()
    await page.waitForFunction(
        () => (window as any).__mpad__?.getDrawingConnection() === 'connected',
    )
    await expect(page.getByTestId('drawing-workspace')).toBeVisible()

    await context.close()
})

test('keeps drawings split by exact pad path', async ({ browser }) => {
    const root = `drawings-${Date.now()}`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, `${root}/one`)
    await openPad(pageB, `${root}/two`)

    await openDrawingRoom(pageA)
    await openDrawingRoom(pageB)

    await pageA.evaluate(() => (window as any).__mpad__.insertTestRectangle())
    await expect
        .poll(async () =>
            pageB.evaluate(
                () => (window as any).__mpad__?.getDrawingElementCount() ?? -1,
            ),
        )
        .toBe(0)

    await contextA.close()
    await contextB.close()
})

function readExcalidrawTheme(page: import('@playwright/test').Page) {
    return page.evaluate(
        () => window.__mpadDrawingApi__?.getAppState()?.theme ?? null,
    )
}
