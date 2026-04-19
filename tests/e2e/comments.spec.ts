import {
    expect,
    openPad,
    test,
    waitForCommentThreadCount,
    waitForPad,
    waitForTextHistoryCount,
    waitForText,
} from '$/e2e/mpad-test'

test('creates a comment from a selected span and opens the thread on highlight click', async ({
    browser,
}) => {
    const path = `notes/${Date.now()}-comments-ui`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await page.evaluate(() =>
        (window as any).__mpad__.setText('alpha beta gamma'),
    )
    await waitForText(page, 'alpha beta gamma')

    await page.evaluate(() =>
        (window as any).__mpad__.selectCommentRange(6, 10),
    )
    await expect(
        page.getByRole('button', { name: 'Comment', exact: true }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Comment', exact: true }).click()
    await expect(page.getByTestId('comment-card')).toBeVisible()

    await page.getByPlaceholder('Add a comment').fill('Root note')
    await page.getByRole('button', { name: 'Add comment', exact: true }).click()
    await waitForCommentThreadCount(page, 1)
    await expect(page.locator('.cm-comment-highlight').first()).toBeVisible()
    await expect(page.getByTestId('comment-marker')).toHaveCount(1)

    await page
        .getByRole('button', { name: 'Close comment', exact: true })
        .click()
    await expect(page.getByTestId('comment-card')).toHaveCount(0)

    await page.locator('.cm-comment-highlight').first().click()
    await expect(page.getByTestId('comment-card')).toBeVisible()
    await expect
        .poll(async () =>
            page.evaluate(
                () =>
                    (window as any).__mpad__?.getCommentThreads()?.[0]
                        ?.selected ?? false,
            ),
        )
        .toBe(true)

    await context.close()
})

test('keeps only one floating comment card open and swaps threads from markers', async ({
    browser,
}) => {
    const path = `notes/${Date.now()}-comments-single-open`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await page.evaluate(() =>
        (window as any).__mpad__.setText('alpha\nbeta\ngamma'),
    )
    await waitForText(page, 'alpha\nbeta\ngamma')

    await page.evaluate(() => (window as any).__mpad__.selectCommentRange(0, 5))
    await page.evaluate(() =>
        (window as any).__mpad__.openCommentDraftFromSelection(),
    )
    await page.evaluate(() =>
        (window as any).__mpad__.createCommentThread('Alpha note'),
    )

    await page.evaluate(() =>
        (window as any).__mpad__.selectCommentRange(11, 16),
    )
    await page.evaluate(() =>
        (window as any).__mpad__.openCommentDraftFromSelection(),
    )
    await page.evaluate(() =>
        (window as any).__mpad__.createCommentThread('Gamma note'),
    )

    await waitForCommentThreadCount(page, 2)
    await expect(page.getByTestId('comment-card')).toHaveCount(1)
    await expect(page.getByTestId('comment-marker')).toHaveCount(2)

    await page.getByTestId('comment-marker').nth(0).click()
    await expect(page.getByTestId('comment-card')).toHaveCount(1)
    await expect
        .poll(async () => {
            const threads = await page.evaluate(
                () => (window as any).__mpad__?.getCommentThreads() ?? [],
            )
            return threads.find(
                (thread: { selected: boolean }) => thread.selected,
            )
        })
        .not.toBeNull()

    await page.getByTestId('comment-marker').nth(1).click()
    await expect(page.getByTestId('comment-card')).toHaveCount(1)
    await expect
        .poll(async () => {
            const threads = await page.evaluate(
                () => (window as any).__mpad__?.getCommentThreads() ?? [],
            )
            return threads.filter(
                (thread: { selected: boolean }) => thread.selected,
            ).length
        })
        .toBe(1)
    await expect(page.locator('.comments-quote')).toContainText('gamma')

    await context.close()
})

test('syncs new comment threads between peers', async ({ browser }) => {
    const path = `notes/${Date.now()}-comments-sync`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageA.evaluate(() =>
        (window as any).__mpad__.setText('alpha beta gamma'),
    )
    await waitForText(pageB, 'alpha beta gamma')

    await pageA.evaluate(() =>
        (window as any).__mpad__.selectCommentRange(6, 10),
    )
    await pageA.evaluate(() =>
        (window as any).__mpad__.openCommentDraftFromSelection(),
    )
    await pageA.evaluate(() =>
        (window as any).__mpad__.createCommentThread('Root note'),
    )
    await waitForCommentThreadCount(pageB, 1)
    await expect
        .poll(async () =>
            pageB.evaluate(
                () =>
                    (window as any).__mpad__?.getCommentThreads()?.[0]?.quote ??
                    '',
            ),
        )
        .toBe('beta')
    await expect
        .poll(async () =>
            pageB.evaluate(
                () =>
                    (window as any).__mpad__?.getCommentThreads()?.[0]
                        ?.messages?.[0]?.body ?? '',
            ),
        )
        .toBe('Root note')

    await contextA.close()
    await contextB.close()
})

test('keeps comment threads after a reload', async ({ browser }) => {
    const path = `notes/${Date.now()}-comments-reload`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await page.evaluate(() =>
        (window as any).__mpad__.setText('alpha beta gamma'),
    )
    await waitForText(page, 'alpha beta gamma')
    await waitForTextHistoryCount(page, 1)

    await page.evaluate(() =>
        (window as any).__mpad__.selectCommentRange(6, 10),
    )
    await page.evaluate(() =>
        (window as any).__mpad__.openCommentDraftFromSelection(),
    )
    await page.evaluate(() =>
        (window as any).__mpad__.createCommentThread('Beta note'),
    )
    await waitForCommentThreadCount(page, 1)
    await waitForTextHistoryCount(page, 2)

    await page.reload()
    await waitForPad(page)
    await waitForText(page, 'alpha beta gamma')
    await waitForCommentThreadCount(page, 1)
    await page.getByTestId('comment-marker').first().click()
    await expect(page.getByTestId('comment-card')).toBeVisible()
    await expect
        .poll(async () =>
            page.evaluate(
                () =>
                    (window as any).__mpad__?.getCommentThreads()?.[0]?.quote ??
                    '',
            ),
        )
        .toBe('beta')
    await expect(page.locator('.comments-message-body')).toContainText(
        'Beta note',
    )

    await context.close()
})
