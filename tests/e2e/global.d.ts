import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

export type MpadTestApi = {
    appendText: (content: string) => void
    getText: () => string
    getDrawingConnection: () => string
    getDrawingElementCount: () => number
    getConnection: () => string
    openDrawing: () => void
    insertTestArrow: () => Promise<void>
    insertTestRectangle: () => Promise<void>
    setText: (content: string) => void
}

declare global {
    interface Window {
        __MPAD_TEST_HOST__?: string
        __mpad__?: MpadTestApi
        __mpadDrawingApi__?: ExcalidrawImperativeAPI | null
    }
}
