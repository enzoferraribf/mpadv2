import {
    expect,
    openDiffsTab,
    openPad,
    persistTextRevision,
    readCurrentRightButton,
    readSnapshotRevertButton,
    readSnapshotSideButton,
    test,
    waitForCommentThreadCount,
    waitForHistoryItems,
    waitForText,
    waitForTextHistoryCount,
} from '$/e2e/mpad-test'

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
    await expect(
        page
            .locator('.diff-history-item-number')
            .filter({ hasText: 'Snapshot 2' }),
    ).toHaveCount(1)
    await expect(readSnapshotSideButton(page, 2, 'left')).toHaveAttribute(
        'aria-pressed',
        'true',
    )
    await expect(readCurrentRightButton(page)).toHaveAttribute(
        'aria-pressed',
        'true',
    )
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
    await page
        .getByRole('dialog')
        .getByText('Compare saved snapshots with the current text.')
        .click()
    await waitForHistoryItems(page, 2)
    await expect(page.getByTestId('text-diff-workspace')).toBeVisible()

    await context.close()
})

test('renders the diff workspace', async ({ browser }) => {
    const path = `visuals/diff-workspace-${Date.now()}`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path, { colorScheme: 'dark' })
    await persistTextRevision(page, '# alpha')
    await persistTextRevision(page, '\n## beta')
    await persistTextRevision(page, '\n### gamma')
    await openDiffsTab(page)
    await waitForHistoryItems(page, 3)

    await expect(page.getByTestId('workspace-shell')).toHaveScreenshot(
        'diff-workspace.png',
    )

    await context.close()
})

test('lets you choose older left and newer right snapshots', async ({
    browser,
}) => {
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
    await expect(readSnapshotSideButton(page, 1, 'left')).toHaveAttribute(
        'aria-pressed',
        'true',
    )
    await expect(readSnapshotSideButton(page, 1, 'right')).toBeDisabled()

    await readSnapshotSideButton(page, 2, 'right').click()
    await expect(readSnapshotSideButton(page, 2, 'right')).toHaveAttribute(
        'aria-pressed',
        'true',
    )
    await expect(readCurrentRightButton(page)).toHaveAttribute(
        'aria-pressed',
        'false',
    )
    await expect(page.locator('.cm-changedText').first()).toBeVisible()

    await context.close()
})

test('forces the right side to stay newer than the left', async ({
    browser,
}) => {
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
    await expect(readSnapshotSideButton(page, 3, 'right')).toHaveAttribute(
        'aria-pressed',
        'true',
    )
    await expect(readSnapshotSideButton(page, 3, 'left')).toBeDisabled()
    await expect(readSnapshotSideButton(page, 2, 'left')).toBeEnabled()

    await context.close()
})

test('reverts an older snapshot into a new head snapshot', async ({
    browser,
}) => {
    const path = `notes/${Date.now()}-diffs-revert`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await persistTextRevision(page, '# alpha')
    await persistTextRevision(page, '\n## beta')
    await persistTextRevision(page, '\n### gamma')
    await openDiffsTab(page)
    await waitForHistoryItems(page, 3)

    await readSnapshotRevertButton(page, 1).click()
    await waitForText(page, '# alpha')
    await expect(page.locator('[data-testid="diff-history-item"]')).toHaveCount(
        4,
        { timeout: 7_000 },
    )
    await expect(
        page
            .locator(
                '[data-testid="diff-history-item"] .diff-history-item-number',
            )
            .first(),
    ).toHaveText('Snapshot 4')
    await expect(
        page
            .locator(
                '[data-testid="diff-history-item"] .diff-history-item-note',
            )
            .first(),
    ).toHaveText('Revert to Snapshot 1')

    await context.close()
})

test('reverts comment state with the saved snapshot', async ({ browser }) => {
    const path = `notes/${Date.now()}-diffs-revert-comments`
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

    await openDiffsTab(page)
    await waitForHistoryItems(page, 2)

    await readSnapshotRevertButton(page, 1).click()
    await waitForCommentThreadCount(page, 0)
    await expect(page.locator('[data-testid="diff-history-item"]')).toHaveCount(
        3,
        { timeout: 7_000 },
    )

    await context.close()
})
