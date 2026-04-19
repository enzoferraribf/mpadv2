import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import type { PadPath } from '@mpad/core/pad-path'
import type { LocalPeer } from '@mpad/protocol/peer'
import { useEffect, useMemo, useState } from 'react'
import type { PadTextRoom, TextAwarenessState, TextAwarenessUser } from '@/collab/domain/pad-room-session'
import { useBrowserRoomSession } from '@/collab/infrastructure/use-browser-room-session'
import { createTextAwarenessState } from '@/pad-text/infrastructure/text-awareness'
import {
    browserPadTextHistoryCommand,
    type PadTextHistoryEntry,
} from '@/pad-text/infrastructure/browser-pad-text-history'
import {
    createTextCommentController,
    type TextCommentHighlight,
    type TextCommentResult,
    type TextCommentThreadView,
} from '@/pad-text/infrastructure/text-comment-store'
import {
    closeMissingOverlayThread,
    readOverlayThread,
    type TextCommentOverlay,
} from '@/pad-text/domain/comment-overlay'
import {
    createTextEditorHandle,
    type TextEditorSelection,
} from '@/pad-text/infrastructure/text-editor'

export type TextWorkspaceCommentSelection = TextEditorSelection & {
    canCreate: boolean
    error: string | null
}

export type TextWorkspaceComments = {
    currentSelection: TextWorkspaceCommentSelection | null
    highlights: TextCommentHighlight[]
    overlay: TextCommentOverlay
    overlayThread: TextCommentThreadView | null
    threads: TextCommentThreadView[]
}

export type TextWorkspaceCommentActions = {
    closeOverlay: () => void
    createThread: (body: string) => TextCommentResult<{ threadId: string }>
    deleteMessage: (input: { threadId: string; messageId: string }) => TextCommentResult
    deleteThread: (threadId: string) => TextCommentResult
    editMessage: (input: { threadId: string; messageId: string; body: string }) => TextCommentResult
    openDraftFromSelection: () => boolean
    openThread: (threadId: string | null) => void
    replyToThread: (input: { threadId: string; body: string }) => TextCommentResult<{ messageId: string }>
    setEditorSelection: (selection: TextEditorSelection | null) => void
}

export type TextWorkspaceModel =
    | { kind: 'loading' }
    | {
        kind: 'ready'
        connection: PadTextRoom['status']
        peerCount: number
        content: string
        editor: ReturnType<typeof createTextEditorHandle>
        comments: TextWorkspaceComments
        commentActions: TextWorkspaceCommentActions
        revertToRevision: (input: { revisionId: number; revisionNumber: number }) => Promise<PadTextHistoryEntry>
    }

export function useTextWorkspace(path: PadPath, localPeer: LocalPeer): TextWorkspaceModel {
    const awarenessUser = useMemo<TextAwarenessUser>(() => ({
        name: localPeer.name,
        color: localPeer.textColor,
        colorLight: localPeer.textColorLight,
    }), [localPeer.name, localPeer.textColor, localPeer.textColorLight])
    const localState = useMemo<TextAwarenessState>(() => createTextAwarenessState(awarenessUser), [awarenessUser])
    const room = useBrowserRoomSession({
        path,
        kind: 'text',
        localState,
        open: true,
    }) as PadTextRoom | null
    const [content, setContent] = useState('')
    const [docVersion, setDocVersion] = useState(0)
    const [peerCount, setPeerCount] = useState(1)
    const [editorSelection, setEditorSelection] = useState<TextEditorSelection | null>(null)
    const [overlay, setOverlay] = useState<TextCommentOverlay>({ kind: 'closed' })

    useEffect(() => {
        if (!room) {
            setContent('')
            setDocVersion(0)
            setPeerCount(1)
            return
        }

        const ytext = room.doc.getText(Y_TEXT_KEY)
        const syncDocument = () => {
            setContent(ytext.toString())
            setDocVersion((value) => value + 1)
        }
        const syncPeers = () => setPeerCount(room.awareness.getStates().size)

        room.doc.on('update', syncDocument)
        room.awareness.on('change', syncPeers)
        syncDocument()
        syncPeers()

        return () => {
            room.doc.off('update', syncDocument)
            room.awareness.off('change', syncPeers)
        }
    }, [room])

    useEffect(() => {
        setEditorSelection(null)
        setOverlay({ kind: 'closed' })
    }, [room])

    const editor = useMemo(() => {
        if (!room) return null
        return createTextEditorHandle(room.doc, room.awareness)
    }, [room])

    const commentController = useMemo(() => {
        if (!room) return null
        return createTextCommentController(room.doc, localPeer)
    }, [localPeer, room])

    const threads = useMemo(() => commentController?.listThreads() ?? [], [commentController, docVersion])
    const highlights = useMemo(() => commentController?.getHighlightSpans() ?? [], [commentController, docVersion])
    const currentSelection = useMemo<TextWorkspaceCommentSelection | null>(() => {
        if (!editorSelection || !commentController) return null
        const result = commentController.validateSelection({
            from: editorSelection.from,
            to: editorSelection.to,
            quote: editorSelection.quote,
        })

        return {
            ...editorSelection,
            canCreate: result.ok,
            error: result.ok ? null : result.error,
        }
    }, [commentController, docVersion, editorSelection])
    const overlayThread = useMemo(() => readOverlayThread(overlay, threads), [overlay, threads])

    useEffect(() => {
        setOverlay((value) => closeMissingOverlayThread(value, threads))
    }, [threads])

    useEffect(() => {
        if (overlay.kind !== 'draft' || !commentController) return
        const result = commentController.validateSelection(overlay.selection)
        if (result.ok) return
        setOverlay({ kind: 'closed' })
    }, [commentController, docVersion, overlay])

    if (!room || !editor) return { kind: 'loading' }

    const commentActions: TextWorkspaceCommentActions = {
        closeOverlay() {
            setOverlay({ kind: 'closed' })
        },
        createThread(body) {
            if (!commentController || overlay.kind !== 'draft') return { ok: false, error: 'Select some text first' }
            const result = commentController.createThread({
                selection: overlay.selection,
                body,
            })
            if (result.ok) {
                setOverlay({ kind: 'thread', threadId: result.value.threadId })
            }
            return result
        },
        deleteMessage(input) {
            if (!commentController) return { ok: false, error: 'Comments are unavailable' }
            return commentController.deleteMessage(input)
        },
        deleteThread(threadId) {
            if (!commentController) return { ok: false, error: 'Comments are unavailable' }
            const result = commentController.deleteThread(threadId)
            if (result.ok) setOverlay((value) => value.kind === 'thread' && value.threadId === threadId ? { kind: 'closed' } : value)
            return result
        },
        editMessage(input) {
            if (!commentController) return { ok: false, error: 'Comments are unavailable' }
            return commentController.editMessage(input)
        },
        openDraftFromSelection() {
            if (!currentSelection || !currentSelection.canCreate) return false
            setOverlay({
                kind: 'draft',
                selection: {
                    from: currentSelection.from,
                    to: currentSelection.to,
                    quote: currentSelection.quote,
                },
            })
            return true
        },
        openThread(threadId) {
            if (!threadId) {
                setOverlay({ kind: 'closed' })
                return
            }
            setOverlay((value) => value.kind === 'thread' && value.threadId === threadId ? value : { kind: 'thread', threadId })
        },
        replyToThread(input) {
            if (!commentController) return { ok: false, error: 'Comments are unavailable' }
            return commentController.replyToThread(input)
        },
        setEditorSelection(selection) {
            setEditorSelection(selection)
        },
    }

    return {
        kind: 'ready',
        connection: room.status,
        peerCount,
        content,
        editor,
        comments: {
            currentSelection,
            highlights,
            overlay,
            overlayThread,
            threads,
        },
        commentActions,
        async revertToRevision(input) {
            if (room.status !== 'connected') throw new Error('Text room is not connected')
            return browserPadTextHistoryCommand.revertRevision(path, input.revisionId)
        },
    }
}
