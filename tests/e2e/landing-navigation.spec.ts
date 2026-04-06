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

test('renders the landing shell', async ({ page }) => {
    await openLanding(page)
    await expect(page).toHaveScreenshot('landing-page.png')
})


test('opens a pad from the landing input', async ({ page }) => {
    const path = `landing-${Date.now()}`

    await openLanding(page)
    await page.getByPlaceholder('your-pad-name').fill(path)
    await page.keyboard.press('Enter')
    await waitForPad(page)
    await expect(page).toHaveURL(new RegExp(`/${path}$`))
})


test('shows related pads from the real tree', async ({ browser }) => {
    const root = `docs-${Date.now()}`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, `${root}/two`)
    await openPad(page, `${root}/one/child`)
    await openPad(page, `${root}/branch/start`)

    await expect(page.getByText(`/${root}`, { exact: true })).toBeVisible()
    await expect(page.getByText(`/${root}/two`, { exact: true })).toBeVisible()
    await expect(page.getByText(`/${root}/one/child`, { exact: true })).toBeVisible()

    await context.close()
})


test('shows pads in ascending path order in the sidebar', async ({ browser }) => {
    const root = `test-${Date.now()}`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, `${root}`)
    await openPad(page, `${root}/foo`)
    await openPad(page, `${root}/foo/bar`)
    await openPad(page, `${root}`)

    const labels = await page.locator('.pad-explorer .pad-explorer-item').allTextContents()
    expect(labels).toEqual([
        `/${root}`,
        `/${root}/foo`,
        `/${root}/foo/bar`,
    ])

    await context.close()
})

