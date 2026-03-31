import type { Browser, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const demoText = '# alpha\n\nint a = 1;\nint b = 2;\n\n```cpp\nvector<int> v(2) = {3, 4};\n```'
const narutoPeer = createPeerSeed('Naruto Uzumaki', '#f97316', '#7c2d12', '#ea580c', '#fdba7433')
const sailorMoonPeer = createPeerSeed('Sailor Moon', '#0ea5e9', '#164e63', '#0284c7', '#7dd3fc33')

test.use({
    colorScheme: 'dark',
    viewport: { width: 1600, height: 900 },
})

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

test('syncs markdown between two pads', async ({ browser }) => {
    const path = `notes/${Date.now()}-text`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageA.locator('.cm-content').first().click()
    await pageA.keyboard.type('# shared title')

    await pageB.waitForFunction(() => (window as any).__mmpad__?.getText() === '# shared title')
    await expect(pageB.getByRole('heading', { name: 'shared title' })).toBeVisible()

    await contextA.close()
    await contextB.close()
})

test('syncs edits from both clients in the same pad', async ({ browser }) => {
    const path = `notes/${Date.now()}-both-edit`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageA.evaluate(() => (window as any).__mmpad__.appendText('# alpha'))
    await waitForText(pageB, '# alpha')

    await pageB.evaluate(() => (window as any).__mmpad__.appendText('\n## beta'))
    await waitForText(pageA, '# alpha\n## beta')
    await waitForText(pageB, '# alpha\n## beta')

    await expect(pageA.getByRole('heading', { name: 'alpha' })).toBeVisible()
    await expect(pageB.getByRole('heading', { name: 'beta' })).toBeVisible()

    await contextA.close()
    await contextB.close()
})

test('shows persisted anime peer identity on remote text and drawing cursors', async ({ browser }) => {
    const path = `notes/${Date.now()}-peer-identity`
    const contextA = await createPeerContext(browser, narutoPeer)
    const contextB = await createPeerContext(browser, sailorMoonPeer)
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageA.locator('.cm-content').first().click()
    await pageA.keyboard.type('# badge test')

    await pageB.waitForFunction(() => (window as any).__mmpad__?.getText() === '# badge test')
    await expect(pageB.locator('.cm-ySelectionInfo').filter({ hasText: 'Naruto Uzumaki' })).toBeVisible()
    await expect.poll(() => pageA.evaluate(() => JSON.parse(window.localStorage.getItem('mmpad.peer')!).name)).toBe('Naruto Uzumaki')

    await pageA.reload()
    await waitForPad(pageA)
    await expect.poll(() => pageA.evaluate(() => JSON.parse(window.localStorage.getItem('mmpad.peer')!).name)).toBe('Naruto Uzumaki')

    await openDrawingRoom(pageA)
    await openDrawingRoom(pageB)
    await moveDrawingPointer(pageA)
    await pageB.waitForFunction(() => {
        const appState = window.__mmpadDrawingApi__?.getAppState()
        if (!appState) return false
        return Array.from(appState.collaborators.values()).some((value) =>
            value.username === 'Naruto Uzumaki' && Boolean(value.pointer),
        )
    })

    await contextA.close()
    await contextB.close()
})

test('keeps remote text badges out of text replacement', async ({ browser }) => {
    const path = `notes/${Date.now()}-peer-badge-leak`
    const contextA = await createPeerContext(browser, narutoPeer)
    const contextB = await createPeerContext(browser, sailorMoonPeer)
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageA.locator('.cm-content').first().click()
    await pageA.keyboard.type('alpha beta gamma')
    for (let step = 0; step < 5; step += 1) {
        await pageA.keyboard.press('ArrowLeft')
    }

    await waitForText(pageB, 'alpha beta gamma')
    const remoteCaret = pageB.locator('.cm-ySelectionCaret').first()
    const remoteBadge = pageB.locator('.cm-ySelectionInfo').filter({ hasText: 'Naruto Uzumaki' }).first()

    await expect(remoteBadge).toBeVisible()
    await expect(remoteCaret).toHaveAttribute('contenteditable', 'false')
    await expect(remoteCaret).toHaveAttribute('aria-hidden', 'true')
    await expect(remoteCaret).toHaveAttribute('draggable', 'false')
    await expect(remoteCaret).toHaveAttribute('translate', 'no')
    await expect(remoteBadge).toHaveAttribute('contenteditable', 'false')
    await expect(remoteBadge).toHaveAttribute('aria-hidden', 'true')

    await replaceFirstEditorLine(pageB, 'clean')
    await waitForText(pageA, 'clean')
    await waitForText(pageB, 'clean')

    const sharedText = await pageB.evaluate(() => (window as any).__mmpad__?.getText() ?? '')
    expect(sharedText).toBe('clean')
    expect(sharedText).not.toContain('Naruto Uzumaki')

    await contextA.close()
    await contextB.close()
})

test('keeps text after a reload', async ({ browser }) => {
    const path = `notes/${Date.now()}-reload`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await page.evaluate(() => (window as any).__mmpad__.appendText('# persisted'))
    await waitForText(page, '# persisted')

    await page.waitForTimeout(3_500)
    await page.reload()
    await waitForPad(page)
    await waitForText(page, '# persisted')
    await expect(page.getByRole('heading', { name: 'persisted' })).toBeVisible()

    await context.close()
})

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
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await seedDocument(page)
    await hideEditorCaret(page)
    await hideSidebarEntries(page)

    await expect(page).toHaveScreenshot('pad-shell.png', {
        mask: [
            page.locator('.pad-statusbar-conn'),
            page.getByTestId('status-cursor'),
            page.getByTestId('status-clock'),
        ],
    })

    await context.close()
})

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

    await pageA.evaluate(() => (window as any).__mmpad__.insertTestRectangle())
    await pageB.waitForFunction(() => (window as any).__mmpad__?.getDrawingElementCount() === 1)

    await contextA.close()
    await contextB.close()
})

test('persists a local Excalidraw arrow change', async ({ browser }) => {
    const path = `notes/${Date.now()}-drawing-persist`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await openDrawingRoom(page)
    await page.evaluate(() => (window as any).__mmpad__.insertTestArrow())
    await moveDrawingPointer(page)
    await expect.poll(async () =>
        page.evaluate(() => (window as any).__mmpad__?.getDrawingElementCount() ?? -1),
    ).toBe(1)

    await page.waitForTimeout(250)
    await expect.poll(async () =>
        page.evaluate(() => (window as any).__mmpad__?.getDrawingElementCount() ?? -1),
    ).toBe(1)

    await page.reload()
    await waitForPad(page)
    await openDrawingRoom(page)
    await expect.poll(async () =>
        page.evaluate(() => (window as any).__mmpad__?.getDrawingElementCount() ?? -1),
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
    await page.waitForFunction(() => (window as any).__mmpad__?.getDrawingConnection() === 'connected')
    await expect(page.getByTestId('drawing-workspace')).toBeVisible()

    await context.close()
})

test('shows text diffs from the top tab', async ({ browser }) => {
    const path = `notes/${Date.now()}-diffs-tab`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await persistTextRevision(page, '# alpha')
    await persistTextRevision(page, '\n## beta')
    await persistTextRevision(page, '\n### gamma')

    await openDiffsTab(page)
    await waitForHistoryItems(page, 3)

    await expect(page.locator('.markdown-body')).toHaveCount(0)
    await expect(page.getByTestId('text-diff-workspace')).toBeVisible()
    await expect(page.locator('.diff-history-item-number').filter({ hasText: 'Snapshot 2' })).toHaveCount(1)
    await expect(readSnapshotSideButton(page, 2, 'left')).toHaveAttribute('aria-pressed', 'true')
    await expect(readCurrentRightButton(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('text-diff-merge')).toBeVisible()
    await expect(page.locator('.cm-changedLine').first()).toBeVisible()

    await context.close()
})

test('opens the diff workspace from the command menu', async ({ browser }) => {
    const path = `notes/${Date.now()}-diffs-menu`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await persistTextRevision(page, '# alpha')
    await persistTextRevision(page, '\n## beta')

    await page.keyboard.press('Control+,')
    await page.getByRole('dialog').getByText('Compare saved snapshots with the current text.').click()
    await waitForHistoryItems(page, 2)
    await expect(page.getByTestId('text-diff-workspace')).toBeVisible()

    await context.close()
})

test('renders the diff workspace', async ({ browser }) => {
    const path = `visuals/diff-workspace-${Date.now()}`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await persistTextRevision(page, '# alpha')
    await persistTextRevision(page, '\n## beta')
    await persistTextRevision(page, '\n### gamma')
    await openDiffsTab(page)
    await waitForHistoryItems(page, 3)

    await expect(page.getByTestId('workspace-shell')).toHaveScreenshot('diff-workspace.png')

    await context.close()
})

test('lets you choose older left and newer right snapshots', async ({ browser }) => {
    const path = `notes/${Date.now()}-diffs-pickers`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await persistTextRevision(page, '# alpha')
    await persistTextRevision(page, '\n## beta')
    await persistTextRevision(page, '\n### gamma')
    await openDiffsTab(page)
    await waitForHistoryItems(page, 3)

    await readSnapshotSideButton(page, 1, 'left').click()
    await expect(readSnapshotSideButton(page, 1, 'left')).toHaveAttribute('aria-pressed', 'true')
    await expect(readSnapshotSideButton(page, 1, 'right')).toBeDisabled()

    await readSnapshotSideButton(page, 2, 'right').click()
    await expect(readSnapshotSideButton(page, 2, 'right')).toHaveAttribute('aria-pressed', 'true')
    await expect(readCurrentRightButton(page)).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.cm-changedText').first()).toBeVisible()

    await context.close()
})

test('forces the right side to stay newer than the left', async ({ browser }) => {
    const path = `notes/${Date.now()}-diffs-order`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await persistTextRevision(page, '# alpha')
    await persistTextRevision(page, '\n## beta')
    await persistTextRevision(page, '\n### gamma')
    await openDiffsTab(page)
    await waitForHistoryItems(page, 3)

    await readSnapshotSideButton(page, 3, 'right').click()
    await expect(readSnapshotSideButton(page, 3, 'right')).toHaveAttribute('aria-pressed', 'true')
    await expect(readSnapshotSideButton(page, 3, 'left')).toBeDisabled()
    await expect(readSnapshotSideButton(page, 2, 'left')).toBeEnabled()

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

test('shows live room files to other peers', async ({ browser }) => {
    const path = `notes-${Date.now()}-files-visible`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageA.evaluate(() => (window as any).__mmpad__.uploadTestFile())
    await pageB.waitForFunction(() => (window as any).__mmpad__?.getFileCount() === 1)
    await pageB.keyboard.press('Control+;')
    await expect(pageB.getByText('readme.txt')).toBeVisible()

    await contextA.close()
    await contextB.close()
})

test('downloads a live file from another peer', async ({ browser }) => {
    const path = `notes-${Date.now()}-files-transfer`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageA.evaluate(() => (window as any).__mmpad__.uploadTestFile())
    await pageB.waitForFunction(() => (window as any).__mmpad__?.getFileCount() === 1)
    await pageB.evaluate(() => (window as any).__mmpad__.requestFile('readme.txt'))
    await pageB.waitForFunction(() => (window as any).__mmpad__?.hasLocalFile('readme.txt') === true)

    await contextA.close()
    await contextB.close()
})

test('keeps live files split by exact pad path', async ({ browser }) => {
    const root = `files-${Date.now()}`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, `${root}/one`)
    await openPad(pageB, `${root}/two`)

    await pageA.evaluate(() => (window as any).__mmpad__.uploadTestFile())
    await expect.poll(async () =>
        pageB.evaluate(() => (window as any).__mmpad__?.getFileCount() ?? -1),
    ).toBe(0)

    await pageB.keyboard.press('Control+;')
    await expect(pageB.getByText(`No live files in /${root}/two.`)).toBeVisible()

    await contextA.close()
    await contextB.close()
})

test('removes a live file when the last seeder leaves the room', async ({ browser }) => {
    const path = `notes-${Date.now()}-files-expire`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageA.evaluate(() => (window as any).__mmpad__.uploadTestFile())
    await pageB.waitForFunction(() => (window as any).__mmpad__?.getFileCount() === 1)
    await pageA.goto('/')
    await pageB.waitForFunction(() => (window as any).__mmpad__?.getFileCount() === 0)

    await contextA.close()
    await contextB.close()
})

test('removes a live file when the owner deletes it', async ({ browser }) => {
    const path = `notes-${Date.now()}-files-delete`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageA.evaluate(() => (window as any).__mmpad__.uploadTestFile())
    await pageB.waitForFunction(() => (window as any).__mmpad__?.getFileCount() === 1)
    await pageA.evaluate(() => (window as any).__mmpad__.deleteLocalFile('readme.txt'))
    await pageB.waitForFunction(() => (window as any).__mmpad__?.getFileCount() === 0)

    await contextA.close()
    await contextB.close()
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

    await pageA.evaluate(() => (window as any).__mmpad__.insertTestRectangle())
    await expect.poll(async () =>
        pageB.evaluate(() => (window as any).__mmpad__?.getDrawingElementCount() ?? -1),
    ).toBe(0)

    await contextA.close()
    await contextB.close()
})

async function openLanding(page: Page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
}

async function openPad(page: Page, path: string) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/${path}`)
    await waitForPad(page)
}

async function waitForPad(page: Page) {
    await page.waitForFunction(
        () => Boolean((window as any).__mmpad__) && (window as any).__mmpad__.getConnection() === 'connected',
    )
}

async function openDrawingRoom(page: Page) {
    await page.evaluate(() => (window as any).__mmpad__.openDrawing())
    await page.waitForFunction(() => (window as any).__mmpad__?.getDrawingConnection() === 'connected')
    await expect(page.getByTestId('drawing-workspace')).toBeVisible()
    await page.waitForFunction(() => Boolean(window.__mmpadDrawingApi__))
}

async function openDiffsTab(page: Page) {
    await page.getByRole('button', { name: 'Diffs', exact: true }).click()
    await expect(page.getByTestId('text-diff-workspace')).toBeVisible()
}

async function moveDrawingPointer(page: Page) {
    const canvas = page.locator('canvas').last()
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + 240, box!.y + 180)
}

async function replaceFirstEditorLine(page: Page, value: string) {
    const line = page.locator('.cm-line').first()
    await expect(line).toBeVisible()
    const box = await line.boundingBox()
    expect(box).not.toBeNull()

    const y = box!.y + box!.height / 2
    await page.mouse.move(box!.x + 1, y)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width + 120, y, { steps: 16 })
    await page.mouse.up()
    await page.keyboard.type(value)
}

async function waitForText(page: Page, text: string) {
    await page.waitForFunction((value) => (window as any).__mmpad__?.getText() === value, text)
}

async function waitForHistoryItems(page: Page, count: number) {
    await expect(page.locator('[data-testid="diff-history-item"]')).toHaveCount(count)
}

function readSnapshotSideButton(page: Page, revisionNumber: number, side: 'left' | 'right') {
    return page.getByRole('button', { name: `Select snapshot ${revisionNumber} as ${side}` })
}

function readCurrentRightButton(page: Page) {
    return page.getByRole('button', { name: 'Select current text as right' })
}

async function persistTextRevision(page: Page, content: string) {
    await page.evaluate((value) => (window as any).__mmpad__.appendText(value), content)
    await page.waitForTimeout(3_500)
}

async function setLayout(page: Page, name: 'Editor' | 'Preview' | 'Split') {
    await page.keyboard.press('Control+,')
    await page.getByRole('dialog').getByText(layoutDescription(name)).click()
}

async function seedDocument(page: Page) {
    await page.evaluate((value) => (window as any).__mmpad__.setText(value), demoText)
    await expect(page.getByRole('heading', { name: 'alpha' })).toBeVisible()
}

async function hideEditorCaret(page: Page) {
    await page.addStyleTag({
        content: `
            .cm-cursor, .cm-dropCursor, .cm-selectionLayer {
                display: none !important;
            }
        `,
    })
}

async function hideSidebarEntries(page: Page) {
    await page.addStyleTag({
        content: `
            .pad-explorer-item {
                color: transparent !important;
                background: transparent !important;
                text-shadow: none !important;
            }
        `,
    })
}

function layoutDescription(name: 'Editor' | 'Preview' | 'Split') {
    if (name === 'Editor') return 'Focus the editor.'
    if (name === 'Preview') return 'Focus the preview.'
    return 'Show editor and preview together.'
}

function createPeerSeed(name: string, background: string, stroke: string, textColor: string, textColorLight: string) {
    return {
        name,
        color: { background, stroke },
        textColor,
        textColorLight,
    }
}

async function createPeerContext(browser: Browser, peer: ReturnType<typeof createPeerSeed>) {
    const context = await browser.newContext()
    await context.addInitScript((value) => {
        window.localStorage.setItem('mmpad.peer', JSON.stringify(value))
    }, peer)
    return context
}
