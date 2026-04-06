import {
    expect,
    test,
    createPeerContext,
    hideEditorCaret,
    hideSidebarEntries,
    moveDrawingPointer,
    narutoPeer,
    openDiffsTab,
    openDrawingRoom,
    openLanding,
    openPad,
    persistTextRevision,
    readCurrentRightButton,
    readSnapshotRevertButton,
    readSnapshotSideButton,
    replaceFirstEditorLine,
    sailorMoonPeer,
    seedDocument,
    setLayout,
    waitForCommentThreadCount,
    waitForHistoryItems,
    waitForPad,
    waitForText,
} from './mpad-test'

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
    await pageB.waitForFunction(() => (window as any).__mpad__?.getDrawingElementCount() === 1)

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
    await expect.poll(async () =>
        page.evaluate(() => (window as any).__mpad__?.getDrawingElementCount() ?? -1),
    ).toBe(1)

    await page.waitForTimeout(250)
    await expect.poll(async () =>
        page.evaluate(() => (window as any).__mpad__?.getDrawingElementCount() ?? -1),
    ).toBe(1)

    await page.reload()
    await waitForPad(page)
    await openDrawingRoom(page)
    await expect.poll(async () =>
        page.evaluate(() => (window as any).__mpad__?.getDrawingElementCount() ?? -1),
    ).toBe(1)

    await context.close()
})


test('renders the drawing workspace', async ({ browser }) => {
    const path = 'visuals/drawing-workspace'
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await openDrawingRoom(page)
    await expect(page.getByTestId('workspace-shell')).toHaveScreenshot('drawing-workspace.png', { maxDiffPixels: 600 })

    await context.close()
})


test('opens the drawing workspace from the command menu', async ({ browser }) => {
    const path = `notes/${Date.now()}-drawing-menu`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)

    await page.keyboard.press('Control+,')
    await page.getByRole('dialog').getByText('Excalidraw', { exact: true }).click()
    await page.waitForFunction(() => (window as any).__mpad__?.getDrawingConnection() === 'connected')
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
    await expect.poll(async () =>
        pageB.evaluate(() => (window as any).__mpad__?.getDrawingElementCount() ?? -1),
    ).toBe(0)

    await contextA.close()
    await contextB.close()
})

