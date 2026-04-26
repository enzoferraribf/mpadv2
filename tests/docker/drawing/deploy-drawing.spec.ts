import { expect, test } from '@playwright/test'
import { drawRectangle, openDrawing, openPad, waitForPad } from '../docker-test'

test('opens drawing in docker and keeps the scene after reload', async ({
    page,
}) => {
    const path = `docker-drawing-${Date.now()}`

    await openPad(page, path)
    await openDrawing(page)

    await drawRectangle(page)
    await expect
        .poll(async () =>
            page.evaluate(
                () => window.__mpad__?.getDrawingElementCount() ?? -1,
            ),
        )
        .toBe(1)

    await page.reload()
    await waitForPad(page)
    await openDrawing(page)
    await expect
        .poll(async () =>
            page.evaluate(
                () => window.__mpad__?.getDrawingElementCount() ?? -1,
            ),
        )
        .toBe(1)
})
