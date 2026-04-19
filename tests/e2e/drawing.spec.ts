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

test('@visual renders the drawing workspace', async ({ browser }) => {
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
