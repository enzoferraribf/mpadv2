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

test('labels the editor and rendered task checkboxes', async ({ browser }) => {
    const path = `notes/${Date.now()}-a11y`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await page.evaluate(() => (window as any).__mpad__.setText('- [x] done\n- [ ] todo'))
    await waitForText(page, '- [x] done\n- [ ] todo')

    await expect(page.locator('.cm-content').first()).toHaveAttribute('aria-label', 'Pad text editor')
    await expect(page.locator('.markdown-body input[type="checkbox"]').nth(0)).toHaveAttribute('aria-label', 'Completed task')
    await expect(page.locator('.markdown-body input[type="checkbox"]').nth(0)).toHaveAttribute('tabindex', '-1')
    await expect(page.locator('.markdown-body input[type="checkbox"]').nth(1)).toHaveAttribute('aria-label', 'Incomplete task')
    await expect(page.locator('.markdown-body input[type="checkbox"]').nth(1)).toHaveAttribute('tabindex', '-1')

    await context.close()
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

    await pageB.waitForFunction(() => (window as any).__mpad__?.getText() === '# shared title')
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

    await pageA.evaluate(() => (window as any).__mpad__.appendText('# alpha'))
    await waitForText(pageB, '# alpha')

    await pageB.evaluate(() => (window as any).__mpad__.appendText('\n## beta'))
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

    await pageB.waitForFunction(() => (window as any).__mpad__?.getText() === '# badge test')
    await expect(pageB.locator('.cm-ySelectionInfo').filter({ hasText: 'Naruto Uzumaki' })).toBeVisible()
    await expect.poll(() => pageA.evaluate(() => JSON.parse(window.localStorage.getItem('mpad.peer')!).name)).toBe('Naruto Uzumaki')

    await pageA.reload()
    await waitForPad(pageA)
    await expect.poll(() => pageA.evaluate(() => JSON.parse(window.localStorage.getItem('mpad.peer')!).name)).toBe('Naruto Uzumaki')

    await openDrawingRoom(pageA)
    await openDrawingRoom(pageB)
    await moveDrawingPointer(pageA)
    await pageB.waitForFunction(() => {
        const appState = window.__mpadDrawingApi__?.getAppState()
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

    const sharedText = await pageB.evaluate(() => (window as any).__mpad__?.getText() ?? '')
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
    await page.evaluate(() => (window as any).__mpad__.appendText('# persisted'))
    await waitForText(page, '# persisted')

    await page.waitForTimeout(3_500)
    await page.reload()
    await waitForPad(page)
    await waitForText(page, '# persisted')
    await expect(page.getByRole('heading', { name: 'persisted' })).toBeVisible()

    await context.close()
})

