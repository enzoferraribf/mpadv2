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
            insertTestArrow: () => Promise<void>
            insertTestRectangle: () => Promise<void>
            replyToCommentThread: (threadId: string, body: string) => void
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
    if (workspace.text.kind !== 'ready') {
        delete window.__mpad__
        return
    }

    const { drawing, files, shell, text } = workspace

    window.__mpad__ = {
        appendText: (content: string) => {
            text.editor.appendText(content)
        },
        createCommentThread: (body: string) => {
            text.commentActions.createThread(body)
        },
        deleteCommentMessage: (threadId: string, messageId: string) => {
            text.commentActions.deleteMessage({ threadId, messageId })
        },
        deleteCommentThread: (threadId: string) => {
            text.commentActions.deleteThread(threadId)
        },
        editCommentMessage: (threadId: string, messageId: string, body: string) => {
            text.commentActions.editMessage({ threadId, messageId, body })
        },
        getCommentThreads: () => text.comments.threads.map((thread) => ({
            id: thread.id,
            quote: thread.quote,
            selected:
                text.comments.overlay.kind === 'thread'
                && thread.id === text.comments.overlay.threadId,
            detached: thread.anchor.detached,
            messages: thread.messages.map((message) => ({ id: message.id, body: message.body })),
        })),
        getText: () => text.editor.readContent(),
        getFileCount: () => files.files.length,
        getDrawingConnection: () => drawing.kind === 'ready' ? drawing.connection : 'closed',
        getDrawingElementCount: () =>
            drawing.kind === 'ready'
                ? drawing.drawing.getElements().length
                : 0,
        getConnection: () => shell.status.connection,
        hasLocalFile: (name: string) => files.files.some((file) => file.meta.name === name && file.isLocal),
        openDrawing: () => shell.commands.openTab('drawing'),
        openCommentDraftFromSelection: () => {
            text.commentActions.openDraftFromSelection()
        },
        insertTestArrow: async () => {
            if (!window.__mpadDrawingApi__) throw new Error('Drawing API is unavailable')
            const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
            window.__mpadDrawingApi__.updateScene({
                elements: convertToExcalidrawElements([{ type: 'arrow', x: 80, y: 80, width: 220, height: 120 }]),
            })
        },
        insertTestRectangle: async () => {
            if (drawing.kind !== 'ready') throw new Error('Drawing is closed')
            const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
            drawing.drawing.writeScene(convertToExcalidrawElements([{ type: 'rectangle', x: 80, y: 80, width: 160, height: 120 }]))
        },
        replyToCommentThread: (threadId: string, body: string) => {
            text.commentActions.replyToThread({ threadId, body })
        },
        selectCommentRange: (from: number, to: number) => {
            text.editor.selectRange(from, to)
        },
        selectCommentThread: (threadId: string) => {
            text.commentActions.openThread(threadId)
        },
        setText: (content: string) => {
            text.editor.setText(content)
        },
        uploadTestFile: async () => {
            files.uploadFile(new File(['hello file'], 'readme.txt', { type: 'text/plain' }))
        },
        requestFile: (name: string) => {
            const file = files.files.find((value) => value.meta.name === name)
            if (file) files.downloadFile(file)
        },
        deleteLocalFile: (name: string) => {
            const file = files.files.find((value) => value.meta.name === name && value.isLocal)
            if (file) files.deleteFile(file.meta.id)
        },
    }
}
