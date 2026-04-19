import {
    expect,
    openDiffsTab,
    openPad,
    persistTextRevision,
    readCurrentRightButton,
    readSnapshotRevertButton,
    readSnapshotSideButton,
    test,
    waitForHistoryItems,
    waitForText,
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

test('@visual renders the diff workspace', async ({ browser }) => {
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
