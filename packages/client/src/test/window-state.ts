import type { PadWorkspaceModel } from '@/pad-workspace/application/use-pad-workspace-model'

declare global {
    interface Window {
        __mpad__?: {
            appendText: (content: string) => void
            createCommentThread: (body: string) => void
            deleteCommentMessage: (threadId: string, messageId: string) => void
            deleteCommentThread: (threadId: string) => void
            editCommentMessage: (threadId: string, messageId: string, body: string) => void
            getText: () => string
            getCommentThreads: () => Array<{
                id: string
                status: 'active' | 'resolved'
                quote: string
                selected: boolean
                detached: boolean
                messages: Array<{ id: string; body: string }>
            }>
            getFileCount: () => number
            getDrawingConnection: () => string
            getDrawingElementCount: () => number
            getConnection: () => string
            hasLocalFile: (name: string) => boolean
            openDrawing: () => void
            openCommentDraftFromSelection: () => void
            reopenCommentThread: (threadId: string) => void
            insertTestArrow: () => Promise<void>
            insertTestRectangle: () => Promise<void>
            replyToCommentThread: (threadId: string, body: string) => void
            resolveCommentThread: (threadId: string) => void
            selectCommentRange: (from: number, to: number) => void
            selectCommentThread: (threadId: string) => void
            setText: (content: string) => void
            uploadTestFile: () => Promise<void>
            requestFile: (name: string) => void
            deleteLocalFile: (name: string) => void
        }
    }
}

export function publishWindowState(workspace: PadWorkspaceModel) {
    if (workspace.state.kind !== 'ready') {
        delete window.__mpad__
        return
    }

    const { commands, state } = workspace

    window.__mpad__ = {
        appendText: (content: string) => {
            state.text.editor.appendText(content)
        },
        createCommentThread: (body: string) => {
            commands.createCommentThread(body)
        },
        deleteCommentMessage: (threadId: string, messageId: string) => {
            commands.deleteCommentMessage({ threadId, messageId })
        },
        deleteCommentThread: (threadId: string) => {
            commands.deleteCommentThread(threadId)
        },
        editCommentMessage: (threadId: string, messageId: string, body: string) => {
            commands.editCommentMessage({ threadId, messageId, body })
        },
        getCommentThreads: () => state.text.comments.threads.map((thread) => ({
            id: thread.id,
            status: thread.status,
            quote: thread.quote,
            selected:
                state.text.comments.overlay.kind === 'thread'
                && thread.id === state.text.comments.overlay.threadId,
            detached: thread.anchor.detached,
            messages: thread.messages.map((message) => ({ id: message.id, body: message.body })),
        })),
        getText: () => state.text.editor.readContent(),
        getFileCount: () => state.status.files.length,
        getDrawingConnection: () => state.drawing.kind === 'ready' ? state.drawing.connection : 'closed',
        getDrawingElementCount: () =>
            state.drawing.kind === 'ready'
                ? state.drawing.drawing.getElements().length
                : 0,
        getConnection: () => state.status.connection,
        hasLocalFile: (name: string) => state.status.files.some((file) => file.meta.name === name && file.isLocal),
        openDrawing: () => commands.openTab('drawing'),
        openCommentDraftFromSelection: () => {
            commands.openCommentDraftFromSelection()
        },
        reopenCommentThread: (threadId: string) => {
            commands.reopenCommentThread(threadId)
        },
        insertTestArrow: async () => {
            if (!window.__mpadDrawingApi__) throw new Error('Drawing API is unavailable')
            const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
            window.__mpadDrawingApi__.updateScene({
                elements: convertToExcalidrawElements([{ type: 'arrow', x: 80, y: 80, width: 220, height: 120 }]),
            })
        },
        insertTestRectangle: async () => {
            if (state.drawing.kind !== 'ready') throw new Error('Drawing is closed')
            const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
            state.drawing.drawing.writeScene(convertToExcalidrawElements([{ type: 'rectangle', x: 80, y: 80, width: 160, height: 120 }]))
        },
        replyToCommentThread: (threadId: string, body: string) => {
            commands.replyToCommentThread({ threadId, body })
        },
        resolveCommentThread: (threadId: string) => {
            commands.resolveCommentThread(threadId)
        },
        selectCommentRange: (from: number, to: number) => {
            state.text.editor.selectRange(from, to)
        },
        selectCommentThread: (threadId: string) => {
            commands.openCommentThread(threadId)
        },
        setText: (content: string) => {
            state.text.editor.setText(content)
        },
        uploadTestFile: async () => {
            commands.uploadFile(new File(['hello file'], 'readme.txt', { type: 'text/plain' }))
        },
        requestFile: (name: string) => {
            const file = state.status.files.find((value) => value.meta.name === name)
            if (file) commands.downloadFile(file)
        },
        deleteLocalFile: (name: string) => {
            const file = state.status.files.find((value) => value.meta.name === name && value.isLocal)
            if (file) commands.deleteFile(file.meta.id)
        },
    }
}
