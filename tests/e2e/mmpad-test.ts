import type { Browser, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

export const demoText = '# alpha\n\nint a = 1;\nint b = 2;\n\n```cpp\nvector<int> v(2) = {3, 4};\n```'
export const narutoPeer = createPeerSeed('Naruto Uzumaki', '#f97316', '#7c2d12', '#ea580c', '#fdba7433')
export const sailorMoonPeer = createPeerSeed('Sailor Moon', '#0ea5e9', '#164e63', '#0284c7', '#7dd3fc33')

test.use({
    colorScheme: 'dark',
    viewport: { width: 1600, height: 900 },
})
export { expect, test }
export async function openLanding(page: Page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
}

export async function openPad(page: Page, path: string) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/${path}`)
    await waitForPad(page)
}

export async function waitForPad(page: Page) {
    await page.waitForFunction(
        () => Boolean((window as any).__mmpad__) && (window as any).__mmpad__.getConnection() === 'connected',
    )
}

export async function openDrawingRoom(page: Page) {
    await page.evaluate(() => (window as any).__mmpad__.openDrawing())
    await page.waitForFunction(() => (window as any).__mmpad__?.getDrawingConnection() === 'connected')
    await expect(page.getByTestId('drawing-workspace')).toBeVisible()
    await page.waitForFunction(() => Boolean(window.__mmpadDrawingApi__))
}

export async function openDiffsTab(page: Page) {
    await page.getByRole('button', { name: 'Diffs', exact: true }).click()
    await expect(page.getByTestId('text-diff-workspace')).toBeVisible()
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
    await page.waitForFunction((value) => (window as any).__mmpad__?.getText() === value, text)
}

export async function waitForHistoryItems(page: Page, count: number) {
    await expect(page.locator('[data-testid="diff-history-item"]')).toHaveCount(count)
}

export async function waitForCommentThreadCount(page: Page, count: number) {
    await expect.poll(async () =>
        page.evaluate(() => (window as any).__mmpad__?.getCommentThreads()?.length ?? -1),
    ).toBe(count)
}

export function readSnapshotSideButton(page: Page, revisionNumber: number, side: 'left' | 'right') {
    return page.getByRole('button', { name: `Select snapshot ${revisionNumber} as ${side}` })
}

export function readSnapshotRevertButton(page: Page, revisionNumber: number) {
    return page.getByRole('button', { name: `Revert to snapshot ${revisionNumber}` })
}

export function readCurrentRightButton(page: Page) {
    return page.getByRole('button', { name: 'Select current text as right' })
}

export async function persistTextRevision(page: Page, content: string) {
    await page.evaluate((value) => (window as any).__mmpad__.appendText(value), content)
    await page.waitForTimeout(3_500)
}

export async function setLayout(page: Page, name: 'Editor' | 'Preview' | 'Split') {
    await page.keyboard.press('Control+,')
    await page.getByRole('dialog').getByText(layoutDescription(name)).click()
}

export async function seedDocument(page: Page) {
    await page.evaluate((value) => (window as any).__mmpad__.setText(value), demoText)
    await expect(page.getByRole('heading', { name: 'alpha' })).toBeVisible()
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

export function createPeerSeed(name: string, background: string, stroke: string, textColor: string, textColorLight: string) {
    return {
        id: `peer-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`,
        name,
        color: { background, stroke },
        textColor,
        textColorLight,
    }
}

export async function createPeerContext(browser: Browser, peer: ReturnType<typeof createPeerSeed>) {
    const context = await browser.newContext()
    await context.addInitScript((value) => {
        window.localStorage.setItem('mmpad.peer', JSON.stringify(value))
    }, peer)
    return context
}
