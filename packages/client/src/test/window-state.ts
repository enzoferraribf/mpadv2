import { Y_DRAWING_ELEMENTS_KEY, Y_TEXT_KEY } from '@mmpad/shared'
import { writeDrawingScene } from '@/pad-drawing/drawing-scene'
import type { ReadyPadPageState } from '@/app/use-pad-page'

declare global {
    interface Window {
        __mmpad__?: {
            appendText: (content: string) => void
            getText: () => string
            getFileCount: () => number
            getDrawingConnection: () => string
            getDrawingElementCount: () => number
            getConnection: () => string
            hasLocalFile: (name: string) => boolean
            openDrawing: () => void
            insertTestRectangle: () => Promise<void>
            uploadTestFile: () => Promise<void>
            requestFile: (name: string) => void
            deleteLocalFile: (name: string) => void
        }
    }
}

export function publishWindowState(input: {
    page: ReadyPadPageState | null
    openDrawing: () => void
}) {
    if (!input.page) {
        delete window.__mmpad__
        return
    }

    const { page } = input

    window.__mmpad__ = {
        appendText: (content: string) => {
            const text = page.text.room.doc.getText(Y_TEXT_KEY)
            text.insert(text.length, content)
        },
        getText: () => page.text.room.doc.getText(Y_TEXT_KEY).toString(),
        getFileCount: () => page.files.length,
        getDrawingConnection: () => page.drawing.kind === 'ready' ? page.drawing.room.status : 'closed',
        getDrawingElementCount: () =>
            page.drawing.kind === 'ready'
                ? page.drawing.room.doc.getMap(Y_DRAWING_ELEMENTS_KEY).size
                : 0,
        getConnection: () => page.view.connection,
        hasLocalFile: (name: string) => page.files.some((file) => file.meta.name === name && file.isLocal),
        openDrawing: () => input.openDrawing(),
        insertTestRectangle: async () => {
            if (page.drawing.kind !== 'ready') throw new Error('Drawing is closed')
            const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
            writeDrawingScene(
                page.drawing.room.doc,
                convertToExcalidrawElements([{ type: 'rectangle', x: 80, y: 80, width: 160, height: 120 }]),
            )
        },
        uploadTestFile: async () => {
            page.uploadFile(new File(['hello file'], 'readme.txt', { type: 'text/plain' }))
        },
        requestFile: (name: string) => {
            const file = page.files.find((value) => value.meta.name === name)
            if (file) page.downloadFile(file)
        },
        deleteLocalFile: (name: string) => {
            const file = page.files.find((value) => value.meta.name === name && value.isLocal)
            if (file) page.deleteFile(file.meta.id)
        },
    }
}
