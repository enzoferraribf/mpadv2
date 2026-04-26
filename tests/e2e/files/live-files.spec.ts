import { expect, openPad, test } from '$/e2e/mpad-test'

test('downloads a live file from another peer', async ({ browser }) => {
    const path = `notes-${Date.now()}-files-transfer`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await pageB.evaluate(() => window.__mpad__.openFiles())
    await pageB.waitForFunction(
        () => window.__mpad__?.getFileConnection() === 'connected',
    )
    await pageA.evaluate(() => window.__mpad__.uploadTestFile())
    await pageA.waitForFunction(
        () => window.__mpad__?.getFileConnection() === 'connected',
    )
    await pageB.waitForFunction(() => window.__mpad__?.getFileCount() === 1)
    await pageB.evaluate(() => window.__mpad__.requestFile('readme.txt'))
    await pageB.waitForFunction(
        () => window.__mpad__?.hasLocalFile('readme.txt') === true,
    )

    await contextA.close()
    await contextB.close()
})
