import {
    expect,
    hideEditorCaret,
    hideSidebarEntries,
    openDrawingRoom,
    openLanding,
    openPad,
    seedDocument,
    test,
} from '$/e2e/mpad-test'

test('@visual renders the landing shell in dark media', async ({ page }) => {
    await openLanding(page, { colorScheme: 'dark' })
    await expect(page).toHaveScreenshot('landing-page.png')
})

test('@visual renders the landing shell in light media', async ({ page }) => {
    await openLanding(page, { colorScheme: 'light' })
    await expect(page).toHaveScreenshot('landing-page-light.png')
})

test('@visual renders the pad shell', async ({ browser }) => {
    const context = await browser.newContext({
        colorScheme: 'dark',
        viewport: { width: 1600, height: 900 },
    })
    const page = await context.newPage()

    await openPad(page, 'visuals/pad-shell', { colorScheme: 'dark' })
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

test('@visual renders the pad shell under light media', async ({ browser }) => {
    const context = await browser.newContext({
        viewport: { width: 1600, height: 900 },
    })
    const page = await context.newPage()

    await openPad(page, 'visuals/pad-shell-light-media', {
        colorScheme: 'light',
    })
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
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, 'visuals/command-menu', { colorScheme: 'dark' })
    await seedDocument(page)
    await page.keyboard.press('Control+,')

    await expect(page.getByRole('dialog')).toHaveScreenshot('command-menu.png')

    await context.close()
})

test('@visual renders the drawing workspace', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, 'visuals/drawing-workspace', { colorScheme: 'dark' })
    await openDrawingRoom(page)

    await expect(page.getByTestId('workspace-shell')).toHaveScreenshot(
        'drawing-workspace.png',
        { maxDiffPixels: 600 },
    )

    await context.close()
})
