import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

export type MpadTestApi = {
    appendText: (content: string) => void
    getText: () => string
    getFileCount: () => number
    getDrawingConnection: () => string
    getDrawingElementCount: () => number
    getConnection: () => string
    hasLocalFile: (name: string) => boolean
    openDrawing: () => void
    insertTestArrow: () => Promise<void>
    insertTestRectangle: () => Promise<void>
    setText: (content: string) => void
    uploadTestFile: () => Promise<void>
    requestFile: (name: string) => void
    deleteLocalFile: (name: string) => void
}

declare global {
    interface Window {
        __MPAD_TEST_HOST__?: string
        __mpad__?: MpadTestApi
        __mpadDrawingApi__?: ExcalidrawImperativeAPI | null
    }
}
