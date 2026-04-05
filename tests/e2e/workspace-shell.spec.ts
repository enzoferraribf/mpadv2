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
} from './mmpad-test'

test('keeps the same pad stable across two tabs in one browser context', async ({ browser }) => {
    const path = `notes/${Date.now()}-same-context`
    const context = await browser.newContext()
    const pageA = await context.newPage()
    const pageB = await context.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await expect(pageB.getByTestId('workspace-shell')).toBeVisible()
    await expect(pageB.getByText('Something went wrong!')).toHaveCount(0)

    await pageA.evaluate(() => (window as any).__mmpad__.appendText('# mirrored'))
    await waitForText(pageB, '# mirrored')

    await context.close()
})


test('renders the pad shell', async ({ browser }) => {
    const path = 'visuals/pad-shell'
    const context = await browser.newContext({
        colorScheme: 'dark',
        viewport: { width: 1600, height: 900 },
    })
    const page = await context.newPage()

    await openPad(page, path)
    await seedDocument(page)
    await hideEditorCaret(page)
    await hideSidebarEntries(page)

    await expect(page).toHaveScreenshot('pad-shell.png', {
        maxDiffPixels: 200,
        mask: [
            page.locator('.pad-statusbar-conn'),
            page.getByTestId('status-cursor'),
            page.getByTestId('status-clock'),
        ],
    })

    await context.close()
})


test('renders the command menu', async ({ browser }) => {
    const path = 'visuals/command-menu'
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await seedDocument(page)
    await page.keyboard.press('Control+,')

    await expect(page.getByRole('dialog')).toHaveScreenshot('command-menu.png')

    await context.close()
})


test('keeps the shell height stable when switching layouts', async ({ browser }) => {
    const path = `notes/${Date.now()}-layout`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)

    const before = await page.locator('main').boundingBox()
    expect(before).not.toBeNull()

    await setLayout(page, 'Preview')
    const preview = await page.locator('main').boundingBox()
    expect(preview).not.toBeNull()

    await setLayout(page, 'Editor')
    const editor = await page.locator('main').boundingBox()
    expect(editor).not.toBeNull()

    expect(Math.round(preview!.height)).toBe(Math.round(before!.height))
    expect(Math.round(editor!.height)).toBe(Math.round(before!.height))

    await context.close()
})


test('keeps the shell height stable when switching tabs', async ({ browser }) => {
    const path = `notes/${Date.now()}-tabs`
    const padName = path.split('/').at(-1)!
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)

    const before = await page.locator('main').boundingBox()
    expect(before).not.toBeNull()

    await openDrawingRoom(page)
    const drawing = await page.locator('main').boundingBox()
    expect(drawing).not.toBeNull()

    await page.getByRole('button', { name: 'Files', exact: true }).click()
    const files = await page.locator('main').boundingBox()
    expect(files).not.toBeNull()

    await page.getByRole('button', { name: padName, exact: true }).click()
    const text = await page.locator('main').boundingBox()
    expect(text).not.toBeNull()

    expect(Math.round(drawing!.height)).toBe(Math.round(before!.height))
    expect(Math.round(files!.height)).toBe(Math.round(before!.height))
    expect(Math.round(text!.height)).toBe(Math.round(before!.height))

    await context.close()
})
