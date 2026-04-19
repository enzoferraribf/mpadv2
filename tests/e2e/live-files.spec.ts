import { expect, openPad, test } from '$/e2e/mpad-test'

test('shows live room files to other peers', async ({ browser }) => {
    const path = `notes-${Date.now()}-files-visible`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageB.keyboard.press('Control+;')
    await pageA.evaluate(() => (window as any).__mpad__.uploadTestFile())
    await pageB.waitForFunction(
        () => (window as any).__mpad__?.getFileCount() === 1,
    )
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

    await pageB.keyboard.press('Control+;')
    await pageA.evaluate(() => (window as any).__mpad__.uploadTestFile())
    await pageB.waitForFunction(
        () => (window as any).__mpad__?.getFileCount() === 1,
    )
    await pageB.evaluate(() =>
        (window as any).__mpad__.requestFile('readme.txt'),
    )
    await pageB.waitForFunction(
        () => (window as any).__mpad__?.hasLocalFile('readme.txt') === true,
    )

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

    await pageA.evaluate(() => (window as any).__mpad__.uploadTestFile())
    await expect
        .poll(async () =>
            pageB.evaluate(
                () => (window as any).__mpad__?.getFileCount() ?? -1,
            ),
        )
        .toBe(0)

    await pageB.keyboard.press('Control+;')
    await expect(
        pageB.getByText(`No live files in /${root}/two.`),
    ).toBeVisible()

    await contextA.close()
    await contextB.close()
})

test('removes a live file when the last seeder leaves the room', async ({
    browser,
}) => {
    const path = `notes-${Date.now()}-files-expire`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageB.keyboard.press('Control+;')
    await pageA.evaluate(() => (window as any).__mpad__.uploadTestFile())
    await pageB.waitForFunction(
        () => (window as any).__mpad__?.getFileCount() === 1,
    )
    await pageA.goto('/')
    await pageB.waitForFunction(
        () => (window as any).__mpad__?.getFileCount() === 0,
    )

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

    await pageB.keyboard.press('Control+;')
    await pageA.evaluate(() => (window as any).__mpad__.uploadTestFile())
    await pageB.waitForFunction(
        () => (window as any).__mpad__?.getFileCount() === 1,
    )
    await pageA.evaluate(() =>
        (window as any).__mpad__.deleteLocalFile('readme.txt'),
    )
    await pageB.waitForFunction(
        () => (window as any).__mpad__?.getFileCount() === 0,
    )

    await contextA.close()
    await contextB.close()
})
