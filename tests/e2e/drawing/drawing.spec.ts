import {
    expect,
    moveDrawingPointer,
    openDrawingRoom,
    openPad,
    test,
    waitForPad,
} from '$/e2e/mpad-test'

test('syncs the drawing surface between two pads', async ({ browser }) => {
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
    await pageB.waitForFunction(
        () => window.__mpad__?.getDrawingElementCount() === 1,
    )

    await contextA.close()
    await contextB.close()
})

test('keeps a local line gesture active while a peer commits a shape', async ({
    browser,
}) => {
    const path = `notes/${Date.now()}-drawing-line-concurrency`
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openPad(pageA, path)
    await openPad(pageB, path)

    await openDrawingRoom(pageA)
    await openDrawingRoom(pageB)

    await pageA.evaluate(() => {
        window.__mpadDrawingApi__?.setActiveTool({ type: 'line' })
    })

    const canvas = pageA.locator('canvas').last()
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()

    await pageA.mouse.move(box!.x + 220, box!.y + 220)
    await pageA.mouse.down()
    await pageA.mouse.move(box!.x + 360, box!.y + 300, { steps: 12 })

    await pageB.evaluate(() => window.__mpad__.insertTestRectangle())
    await pageA.waitForTimeout(250)

    await pageA.mouse.move(box!.x + 520, box!.y + 380, { steps: 12 })
    await pageA.mouse.up()

    await expect
        .poll(async () => readDrawingElementTypes(pageA))
        .toEqual(expect.arrayContaining(['line', 'rectangle']))
    await expect
        .poll(async () => readDrawingElementTypes(pageB))
        .toEqual(expect.arrayContaining(['line', 'rectangle']))

    await contextA.close()
    await contextB.close()
})

test('persists a local Excalidraw arrow change', async ({ browser }) => {
    const path = `notes/${Date.now()}-drawing-persist`
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path)
    await openDrawingRoom(page)
    await page.evaluate(() => window.__mpad__.insertTestArrow())
    await moveDrawingPointer(page)
    await expect
        .poll(async () =>
            page.evaluate(
                () => window.__mpad__?.getDrawingElementCount() ?? -1,
            ),
        )
        .toBe(1)

    await page.reload()
    await waitForPad(page)
    await openDrawingRoom(page)
    await expect
        .poll(async () =>
            page.evaluate(
                () => window.__mpad__?.getDrawingElementCount() ?? -1,
            ),
        )
        .toBe(1)

    await context.close()
})

async function readDrawingElementTypes(page: Parameters<typeof openPad>[0]) {
    return page.evaluate(() =>
        window.__mpadDrawingApi__
            ?.getSceneElementsIncludingDeleted()
            .filter((element) => !element.isDeleted)
            .map((element) => element.type)
            .sort(),
    )
}

test('@visual renders the drawing workspace', async ({ browser }) => {
    const path = 'visuals/drawing-workspace'
    const context = await browser.newContext()
    const page = await context.newPage()

    await openPad(page, path, { colorScheme: 'dark' })
    await openDrawingRoom(page)
    await expect(page.getByTestId('workspace-shell')).toHaveScreenshot(
        'drawing-workspace.png',
        { maxDiffPixels: 600 },
    )

    await context.close()
})
