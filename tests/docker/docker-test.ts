import { type Page, expect } from '@playwright/test'

export async function waitForPad(page: Page) {
    await page.waitForFunction(() => Boolean(window.__mpad__))
}

export async function openPad(page: Page, path: string) {
    await page.goto(`/${path}`)
    await waitForPad(page)
}

export async function openDrawing(page: Page) {
    await page.evaluate(() => window.__mpad__.openDrawing())
    await page.waitForFunction(
        () => window.__mpad__?.getDrawingConnection() === 'connected',
    )
    await expect(page.getByTestId('drawing-workspace')).toBeVisible()
    await page.waitForFunction(() => Boolean(window.__mpadDrawingApi__))
}

export async function readCanvasDataUrl(page: Page) {
    return page
        .locator('canvas')
        .last()
        .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL())
}

export async function drawRectangle(page: Page) {
    await page.evaluate(() => window.__mpad__.insertTestRectangle())
}
