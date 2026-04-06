import {
    expect,
    test,
    openDrawingRoom,
    openPad,
} from './mpad-test'

test('does not load drawing javascript before the drawing tab opens', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => {
        requests.push(request.url())
    })

    await openPad(page, `notes/${Date.now()}-lazy-drawing`)

    expect(requests.some((url) => isDrawingJs(url))).toBe(false)

    await openDrawingRoom(page)

    await expect.poll(() => requests.some((url) => isDrawingJs(url))).toBe(true)
})

function isDrawingJs(url: string) {
    return /\/assets\/drawing-[^/]+\.js($|\?)/.test(url)
}
