import type { PadWorkspaceModel } from '@/workspace/use-pad-workspace'

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

export function publishWindowState(workspace: PadWorkspaceModel) {
    if (workspace.state.kind !== 'ready') {
        delete window.__mmpad__
        return
    }

    const { actions, state } = workspace

    window.__mmpad__ = {
        appendText: (content: string) => {
            state.text.editor.appendText(content)
        },
        getText: () => state.text.editor.readContent(),
        getFileCount: () => state.status.files.length,
        getDrawingConnection: () => state.drawing.kind === 'ready' ? state.drawing.connection : 'closed',
        getDrawingElementCount: () =>
            state.drawing.kind === 'ready'
                ? state.drawing.drawing.getElements().length
                : 0,
        getConnection: () => state.status.connection,
        hasLocalFile: (name: string) => state.status.files.some((file) => file.meta.name === name && file.isLocal),
        openDrawing: () => actions.openTab('drawing'),
        insertTestRectangle: async () => {
            if (state.drawing.kind !== 'ready') throw new Error('Drawing is closed')
            const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
            state.drawing.drawing.writeScene(convertToExcalidrawElements([{ type: 'rectangle', x: 80, y: 80, width: 160, height: 120 }]))
        },
        uploadTestFile: async () => {
            actions.uploadFile(new File(['hello file'], 'readme.txt', { type: 'text/plain' }))
        },
        requestFile: (name: string) => {
            const file = state.status.files.find((value) => value.meta.name === name)
            if (file) actions.downloadFile(file)
        },
        deleteLocalFile: (name: string) => {
            const file = state.status.files.find((value) => value.meta.name === name && value.isLocal)
            if (file) actions.deleteFile(file.meta.id)
        },
    }
}
