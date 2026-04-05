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

test('creates a comment from a selected span and opens the thread on highlight click', async ({ browser }) => {
    const path = `notes/${Date.now()}-comments-ui`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await page.evaluate(() => (window as any).__mmpad__.setText('alpha beta gamma'))
    await waitForText(page, 'alpha beta gamma')

    await page.evaluate(() => (window as any).__mmpad__.selectCommentRange(6, 10))
    await expect(page.getByRole('button', { name: 'Comment', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Comment', exact: true }).click()
    await expect(page.getByTestId('comment-card')).toBeVisible()

    await page.getByPlaceholder('Add a comment').fill('Root note')
    await page.getByRole('button', { name: 'Add comment', exact: true }).click()
    await waitForCommentThreadCount(page, 1)
    await expect(page.locator('.cm-comment-highlight').first()).toBeVisible()
    await expect(page.getByTestId('comment-marker')).toHaveCount(1)

    await page.getByRole('button', { name: 'Close comment', exact: true }).click()
    await expect(page.getByTestId('comment-card')).toHaveCount(0)

    await page.locator('.cm-comment-highlight').first().click()
    await expect(page.getByTestId('comment-card')).toBeVisible()
    await expect.poll(async () =>
        page.evaluate(() => (window as any).__mmpad__?.getCommentThreads()?.[0]?.selected ?? false),
    ).toBe(true)

    await context.close()
})


test('keeps only one floating comment card open and swaps threads from markers', async ({ browser }) => {
    const path = `notes/${Date.now()}-comments-single-open`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await page.evaluate(() => (window as any).__mmpad__.setText('alpha\nbeta\ngamma'))
    await waitForText(page, 'alpha\nbeta\ngamma')

    await page.evaluate(() => (window as any).__mmpad__.selectCommentRange(0, 5))
    await page.evaluate(() => (window as any).__mmpad__.openCommentDraftFromSelection())
    await page.evaluate(() => (window as any).__mmpad__.createCommentThread('Alpha note'))

    await page.evaluate(() => (window as any).__mmpad__.selectCommentRange(11, 16))
    await page.evaluate(() => (window as any).__mmpad__.openCommentDraftFromSelection())
    await page.evaluate(() => (window as any).__mmpad__.createCommentThread('Gamma note'))

    await waitForCommentThreadCount(page, 2)
    await expect(page.getByTestId('comment-card')).toHaveCount(1)
    await expect(page.getByTestId('comment-marker')).toHaveCount(2)

    await page.getByTestId('comment-marker').nth(0).click()
    await expect(page.getByTestId('comment-card')).toHaveCount(1)
    await expect.poll(async () => {
        const threads = await page.evaluate(() => (window as any).__mmpad__?.getCommentThreads() ?? [])
        return threads.find((thread: { selected: boolean }) => thread.selected)
    }).not.toBeNull()

    await page.getByTestId('comment-marker').nth(1).click()
    await expect(page.getByTestId('comment-card')).toHaveCount(1)
    await expect.poll(async () => {
        const threads = await page.evaluate(() => (window as any).__mmpad__?.getCommentThreads() ?? [])
        return threads.filter((thread: { selected: boolean }) => thread.selected).length
    }).toBe(1)
    await expect(page.locator('.comments-quote')).toContainText('gamma')

    await context.close()
})


test('syncs comment threads between peers and keeps them after reload', async ({ browser }) => {
    const path = `notes/${Date.now()}-comments-sync`
    const contextA = await createPeerContext(browser, narutoPeer)
    const contextB = await createPeerContext(browser, sailorMoonPeer)
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageA.evaluate(() => (window as any).__mmpad__.setText('alpha beta gamma'))
    await waitForText(pageB, 'alpha beta gamma')

    await pageA.evaluate(() => (window as any).__mmpad__.selectCommentRange(6, 10))
    await pageA.evaluate(() => (window as any).__mmpad__.openCommentDraftFromSelection())
    await pageA.evaluate(() => (window as any).__mmpad__.createCommentThread('Root note'))
    await waitForCommentThreadCount(pageB, 1)

    const threadId = await pageA.evaluate(() => (window as any).__mmpad__.getCommentThreads()[0].id)
    await pageB.evaluate((value) => (window as any).__mmpad__.replyToCommentThread(value, 'Reply from B'), threadId)
    await expect.poll(async () =>
        pageA.evaluate(() => (window as any).__mmpad__?.getCommentThreads()?.[0]?.messages.length ?? 0),
    ).toBe(2)

    const replyId = await pageA.evaluate(() => (window as any).__mmpad__.getCommentThreads()[0].messages[1].id)
    await pageB.evaluate(
        ({ messageId, value }) => (window as any).__mmpad__.editCommentMessage(value.threadId, messageId, 'Reply from B updated'),
        { messageId: replyId, value: { threadId } },
    )
    await expect.poll(async () =>
        pageA.evaluate(() => (window as any).__mmpad__?.getCommentThreads()?.[0]?.messages?.[1]?.body ?? ''),
    ).toBe('Reply from B updated')

    await pageA.evaluate((value) => (window as any).__mmpad__.resolveCommentThread(value), threadId)
    await expect.poll(async () =>
        pageB.evaluate(() => (window as any).__mmpad__?.getCommentThreads()?.[0]?.status ?? ''),
    ).toBe('resolved')

    await pageB.evaluate((value) => (window as any).__mmpad__.reopenCommentThread(value), threadId)
    await expect.poll(async () =>
        pageA.evaluate(() => (window as any).__mmpad__?.getCommentThreads()?.[0]?.status ?? ''),
    ).toBe('active')

    await pageB.evaluate(({ messageId, threadId: id }) => (window as any).__mmpad__.deleteCommentMessage(id, messageId), {
        messageId: replyId,
        threadId,
    })
    await expect.poll(async () =>
        pageA.evaluate(() => (window as any).__mmpad__?.getCommentThreads()?.[0]?.messages.length ?? 0),
    ).toBe(1)

    await pageA.waitForTimeout(3_500)
    await pageA.reload()
    await waitForPad(pageA)
    await waitForText(pageA, 'alpha beta gamma')
    await waitForCommentThreadCount(pageA, 1)
    await pageA.getByTestId('comment-marker').first().click()
    await expect(pageA.getByTestId('comment-card')).toBeVisible()
    await expect.poll(async () =>
        pageA.evaluate(() => (window as any).__mmpad__?.getCommentThreads()?.[0]?.quote ?? ''),
    ).toBe('beta')

    await pageA.evaluate((value) => (window as any).__mmpad__.deleteCommentThread(value), threadId)
    await waitForCommentThreadCount(pageB, 0)

    await contextA.close()
    await contextB.close()
})

