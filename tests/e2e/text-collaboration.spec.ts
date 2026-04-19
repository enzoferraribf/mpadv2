import {
    createPeerContext,
    expect,
    moveDrawingPointer,
    narutoPeer,
    openDrawingRoom,
    openPad,
    replaceFirstEditorLine,
    sailorMoonPeer,
    setLayout,
    test,
    waitForPad,
    waitForTextHistoryCount,
    waitForText,
} from './mpad-test'

test('labels the editor and rendered task checkboxes', async ({ browser }) => {
    const path = `notes/${Date.now()}-a11y`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await page.evaluate(() => (window as any).__mpad__.setText('- [x] done\n- [ ] todo'))
    await waitForText(page, '- [x] done\n- [ ] todo')
    await setLayout(page, 'Split')

    await expect(page.locator('.cm-content').first()).toHaveAttribute('aria-label', 'Pad text editor')
    await expect(page.locator('.markdown-body input[type="checkbox"]').nth(0)).toHaveAttribute('aria-label', 'Completed task')
    await expect(page.locator('.markdown-body input[type="checkbox"]').nth(0)).toHaveAttribute('tabindex', '-1')
    await expect(page.locator('.markdown-body input[type="checkbox"]').nth(1)).toHaveAttribute('aria-label', 'Incomplete task')
    await expect(page.locator('.markdown-body input[type="checkbox"]').nth(1)).toHaveAttribute('tabindex', '-1')

    await context.close()
})

test('renders standalone markdown images inline in the editor and reveals raw markdown while editing', async ({ browser }) => {
    const path = `notes/${Date.now()}-inline-image`
    const context = await browser.newContext()
    const page = await context.newPage()
    const imageUrl = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2040'%3E%3Crect%20width='64'%20height='40'%20fill='%23c9a87c'/%3E%3C/svg%3E"
    const content = `alpha\n\n![badge](${imageUrl})\n\nomega`

    await openPad(page, path)
    await page.evaluate((value) => (window as any).__mpad__.setText(value), content)
    await waitForText(page, content)
    await setLayout(page, 'Split')

    await expect(page.locator('[data-editor-image-widget="true"]')).toHaveCount(1)
    await expect(page.locator('[data-editor-image-widget="true"] img')).toBeVisible()
    await expect(page.locator('.markdown-body img')).toHaveCount(1)

    await page.locator('.cm-line').filter({ hasText: 'alpha' }).first().click()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    await expect(page.locator('[data-editor-image-widget="true"]')).toHaveCount(0)
    await expect(page.locator('.cm-line').filter({ hasText: '![badge](' })).toBeVisible()

    await page.locator('.cm-line').filter({ hasText: 'omega' }).first().click()

    await expect(page.locator('[data-editor-image-widget="true"]')).toHaveCount(1)

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
    await setLayout(pageB, 'Preview')

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
    await setLayout(pageA, 'Split')
    await setLayout(pageB, 'Split')

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
        const appState = window.__mpadDrawingApi__?.getAppState() as {
            collaborators: Map<unknown, { pointer: unknown; username: string }>
        } | null
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

    await waitForTextHistoryCount(page, 1)
    await page.reload()
    await waitForPad(page)
    await waitForText(page, '# persisted')
    await setLayout(page, 'Preview')
    await expect(page.getByRole('heading', { name: 'persisted' })).toBeVisible()

    await context.close()
})
