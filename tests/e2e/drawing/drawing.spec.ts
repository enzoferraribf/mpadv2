import {
    expect,
    openDrawingRoom,
    openPad,
    test,
    waitForPad,
} from '$/e2e/mpad-test'

test('syncs drawing changes and keeps them after reload', async ({
    browser,
}) => {
    const path = `notes/${Date.now()}-drawing`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)
    await openDrawingRoom(pageA)
    await openDrawingRoom(pageB)

    await pageA.evaluate(() => window.__mpad__.insertTestRectangle())
    await expect
        .poll(() =>
            pageB.evaluate(
                () => window.__mpad__?.getDrawingElementCount() ?? -1,
            ),
        )
        .toBe(1)

    await pageB.reload()
    await waitForPad(pageB)
    await openDrawingRoom(pageB)
    await expect
        .poll(() =>
            pageB.evaluate(
                () => window.__mpad__?.getDrawingElementCount() ?? -1,
            ),
        )
        .toBe(1)

    await contextA.close()
    await contextB.close()
})
