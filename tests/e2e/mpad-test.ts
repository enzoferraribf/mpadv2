import { createPeerSeed } from '@mpad/testkit/peer-seed'
import type { Browser, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

export const demoText =
    '# alpha\n\nint a = 1;\nint b = 2;\n\n```cpp\nvector<int> v(2) = {3, 4};\n```'
export const marketingHost = 'missopad.com'
export const brightFoxPeer = createPeerSeed(
    'Bright Fox',
    '#f97316',
    '#7c2d12',
    '#ea580c',
    '#fdba7433',
)
export const calmOtterPeer = createPeerSeed(
    'Calm Otter',
    '#0ea5e9',
    '#164e63',
    '#0284c7',
    '#7dd3fc33',
)

test.use({
    colorScheme: 'dark',
    viewport: { width: 1600, height: 900 },
})
export { expect, test }
type MediaOptions = {
    colorScheme?: 'dark' | 'light'
}

export async function openLanding(page: Page, options?: MediaOptions) {
    await applyMedia(page, options)
    await page.addInitScript((host) => {
        window.__MPAD_TEST_HOST__ = host
    }, marketingHost)
    await page.goto('/')
}

export async function openPad(
    page: Page,
    path: string,
    options?: MediaOptions,
) {
    await applyMedia(page, options)
    await page.goto(`/${path}`)
    await waitForPad(page)
}

export async function waitForPad(page: Page) {
    await page.waitForFunction(
        () =>
            Boolean(window.__mpad__) &&
            window.__mpad__.getConnection() === 'connected',
    )
}

export async function openDrawingRoom(page: Page) {
    await page.evaluate(() => window.__mpad__.openDrawing())
    await page.waitForFunction(
        () => window.__mpad__?.getDrawingConnection() === 'connected',
    )
    await expect(page.getByTestId('drawing-workspace')).toBeVisible()
    await page.waitForFunction(() => Boolean(window.__mpadDrawingApi__))
}

export async function moveDrawingPointer(page: Page) {
    const canvas = page.locator('canvas').last()
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + 240, box!.y + 180)
}

export async function replaceFirstEditorLine(page: Page, value: string) {
    const line = page.locator('.cm-line').first()
    await expect(line).toBeVisible()
    const box = await line.boundingBox()
    expect(box).not.toBeNull()

    const y = box!.y + box!.height / 2
    await page.mouse.move(box!.x + 1, y)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width + 120, y, { steps: 16 })
    await page.mouse.up()
    await page.keyboard.type(value)
}

export async function waitForText(page: Page, text: string) {
    await page.waitForFunction(
        (value) => window.__mpad__?.getText() === value,
        text,
    )
}

export async function setLayout(
    page: Page,
    name: 'Editor' | 'Preview' | 'Split',
) {
    await page.keyboard.press('Control+,')
    await page.getByRole('dialog').getByText(layoutDescription(name)).click()
}

export async function seedDocument(page: Page) {
    await page.evaluate((value) => window.__mpad__.setText(value), demoText)
    await waitForText(page, demoText)
}

export async function hideEditorCaret(page: Page) {
    await page.addStyleTag({
        content: `
            .cm-cursor, .cm-dropCursor, .cm-selectionLayer {
                display: none !important;
            }
        `,
    })
}

export async function hideSidebarEntries(page: Page) {
    await page.addStyleTag({
        content: `
            .pad-explorer-item {
                color: transparent !important;
                background: transparent !important;
                text-shadow: none !important;
            }
        `,
    })
}

export function layoutDescription(name: 'Editor' | 'Preview' | 'Split') {
    if (name === 'Editor') return 'Focus the editor.'
    if (name === 'Preview') return 'Focus the preview.'
    return 'Show editor and preview together.'
}

export async function createPeerContext(
    browser: Browser,
    peer: ReturnType<typeof createPeerSeed>,
) {
    const context = await browser.newContext()
    await context.addInitScript((value) => {
        window.localStorage.setItem('mpad.peer', JSON.stringify(value))
    }, peer)
    return context
}

export async function waitForTextPersistence(page: Page) {
    await page.waitForTimeout(3_500)
}

async function applyMedia(page: Page, options?: MediaOptions) {
    const media: Parameters<Page['emulateMedia']>[0] = {
        reducedMotion: 'reduce',
    }
    if (options?.colorScheme) media.colorScheme = options.colorScheme
    await page.emulateMedia(media)
}
