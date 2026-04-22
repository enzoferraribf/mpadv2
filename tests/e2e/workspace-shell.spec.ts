import {
    expect,
    hideEditorCaret,
    hideSidebarEntries,
    openPad,
    seedDocument,
    test,
} from '$/e2e/mpad-test'

test('@visual renders the pad shell', async ({ browser }) => {
    const path = 'visuals/pad-shell'
    const context = await browser.newContext({
        colorScheme: 'dark',
        viewport: { width: 1600, height: 900 },
    })
    const page = await context.newPage()

    await openPad(page, path, { colorScheme: 'dark' })
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

test('@visual renders the legacy pad shell under light media', async ({
    browser,
}) => {
    const path = 'visuals/pad-shell-light-media'
    const context = await browser.newContext({
        viewport: { width: 1600, height: 900 },
    })
    const page = await context.newPage()

    await openPad(page, path, { colorScheme: 'light' })
    await seedDocument(page)
    await hideEditorCaret(page)
    await hideSidebarEntries(page)

    expect(
        await page.evaluate(
            () => getComputedStyle(document.documentElement).colorScheme,
        ),
    ).toBe('light')

    await expect(page).toHaveScreenshot('pad-shell-light-media.png', {
        maxDiffPixels: 200,
        mask: [
            page.locator('.pad-statusbar-conn'),
            page.getByTestId('status-cursor'),
            page.getByTestId('status-clock'),
        ],
    })

    await context.close()
})

test('@visual renders the command menu', async ({ browser }) => {
    const path = 'visuals/command-menu'
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path, { colorScheme: 'dark' })
    await seedDocument(page)
    await page.keyboard.press('Control+,')

    await expect(page.getByRole('dialog')).toHaveScreenshot('command-menu.png')

    await context.close()
})
