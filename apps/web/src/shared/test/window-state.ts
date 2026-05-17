import type { PadPageController } from '@/features/workspace/application/controller'

declare global {
    interface Window {
        __mpad__?: {
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
    }
}

export function publishWindowState(workspace: PadPageController) {
    if (workspace.text.kind !== 'ready') {
        delete window.__mpad__
        return
    }

    const { drawing, shell, text } = workspace

    window.__mpad__ = {
        appendText: (content: string) => {
            text.editor.appendText(content)
        },
        getText: () => text.editor.readContent(),
        getDrawingConnection: () =>
            drawing.kind === 'ready' ? drawing.connection : 'closed',
        getDrawingElementCount: () =>
            drawing.kind === 'ready' ? drawing.drawing.getElements().length : 0,
        getConnection: () => shell.status.connection,
        openDrawing: () => shell.commands.openTab('drawing'),
        insertTestArrow: async () => {
            if (!window.__mpadDrawingApi__)
                throw new Error('Drawing API is unavailable')
            const { convertToExcalidrawElements } = await import(
                '@excalidraw/excalidraw'
            )
            window.__mpadDrawingApi__.updateScene({
                elements: convertToExcalidrawElements([
                    { type: 'arrow', x: 80, y: 80, width: 220, height: 120 },
                ]),
            })
        },
        insertTestRectangle: async () => {
            if (drawing.kind !== 'ready') throw new Error('Drawing is closed')
            const { convertToExcalidrawElements } = await import(
                '@excalidraw/excalidraw'
            )
            drawing.drawing.writeScene(
                convertToExcalidrawElements([
                    {
                        type: 'rectangle',
                        x: 80,
                        y: 80,
                        width: 160,
                        height: 120,
                    },
                ]),
            )
        },
        setText: (content: string) => {
            text.editor.setText(content)
        },
    }
}
