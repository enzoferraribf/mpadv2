import { Y_TEXT_KEY, type LocalPeer, type PadPath } from '@mmpad/shared'
import { useEffect, useMemo, useState } from 'react'
import type { PadTextRoom, TextAwarenessState, TextAwarenessUser } from '@/pad-session/pad-room-types'
import { createTextAwarenessState } from '@/pad-text/infrastructure/text-awareness'
import { usePadRoomSession } from '@/pad-session/use-pad-room-session'
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

export type TextPadCommentSelection = TextEditorSelection & {
    canCreate: boolean
    error: string | null
}

export type TextPadComments = {
    currentSelection: TextPadCommentSelection | null
    highlights: TextCommentHighlight[]
    overlay: TextCommentOverlay
    overlayThread: TextCommentThreadView | null
    threads: TextCommentThreadView[]
}

export type TextPadCommentActions = {
    closeOverlay: () => void
    createThread: (body: string) => TextCommentResult<{ threadId: string }>
    deleteMessage: (input: { threadId: string; messageId: string }) => TextCommentResult
    deleteThread: (threadId: string) => TextCommentResult
    editMessage: (input: { threadId: string; messageId: string; body: string }) => TextCommentResult
    openDraftFromSelection: () => boolean
    openThread: (threadId: string | null) => void
    reopenThread: (threadId: string) => TextCommentResult
    replyToThread: (input: { threadId: string; body: string }) => TextCommentResult<{ messageId: string }>
    resolveThread: (threadId: string) => TextCommentResult
    setEditorSelection: (selection: TextEditorSelection | null) => void
}

export type TextPadModel =
    | { kind: 'loading' }
    | {
        kind: 'ready'
        connection: PadTextRoom['status']
        peerCount: number
        content: string
        editor: ReturnType<typeof createTextEditorHandle>
        comments: TextPadComments
        commentActions: TextPadCommentActions
    }

export function useTextPad(path: PadPath, localPeer: LocalPeer): TextPadModel {
    const awarenessUser = useMemo<TextAwarenessUser>(() => ({
        name: localPeer.name,
        color: localPeer.textColor,
        colorLight: localPeer.textColorLight,
    }), [localPeer.name, localPeer.textColor, localPeer.textColorLight])
    const localState = useMemo<TextAwarenessState>(() => createTextAwarenessState(awarenessUser), [awarenessUser])
    const room = usePadRoomSession({
        path,
        kind: 'text',
        localState,
        open: true,
    }) as PadTextRoom | null
    const [content, setContent] = useState('')
    const [peerCount, setPeerCount] = useState(1)
    const [commentTick, setCommentTick] = useState(0)
    const [editorSelection, setEditorSelection] = useState<TextEditorSelection | null>(null)
    const [overlay, setOverlay] = useState<TextCommentOverlay>({ kind: 'closed' })

    useEffect(() => {
        if (!room) {
            setContent('')
            setPeerCount(1)
            return
        }

        const ytext = room.doc.getText(Y_TEXT_KEY)
        const syncContent = () => {
            setContent(ytext.toString())
            setCommentTick((value) => value + 1)
        }
        const syncPeers = () => setPeerCount(room.awareness.getStates().size)

        room.doc.on('update', syncContent)
        room.awareness.on('change', syncPeers)
        syncContent()
        syncPeers()
        const commentRefreshTimers = [0, 50, 250].map((delay) => window.setTimeout(() => {
            setCommentTick((value) => value + 1)
        }, delay))

        return () => {
            room.doc.off('update', syncContent)
            room.awareness.off('change', syncPeers)
            for (const timer of commentRefreshTimers) window.clearTimeout(timer)
        }
    }, [room])

    useEffect(() => {
        setCommentTick(0)
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

    useEffect(() => {
        if (!commentController) return
        setCommentTick((value) => value + 1)
    }, [commentController])

    const threads = useMemo(() => commentController?.listThreads() ?? [], [commentController, commentTick])
    const highlights = useMemo(() => commentController?.getHighlightSpans() ?? [], [commentController, commentTick])
    const currentSelection = useMemo<TextPadCommentSelection | null>(() => {
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
    }, [commentController, commentTick, editorSelection])
    const overlayThread = useMemo(
        () => readOverlayThread(overlay, threads),
        [overlay, threads],
    )

    useEffect(() => {
        setOverlay((value) => closeMissingOverlayThread(value, threads))
    }, [threads])

    useEffect(() => {
        if (overlay.kind !== 'draft' || !commentController) return
        const result = commentController.validateSelection(overlay.selection)
        if (result.ok) return
        setOverlay({ kind: 'closed' })
    }, [commentController, commentTick, overlay])

    if (!room || !editor) return { kind: 'loading' }

    const commentActions: TextPadCommentActions = {
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
        reopenThread(threadId) {
            if (!commentController) return { ok: false, error: 'Comments are unavailable' }
            return commentController.reopenThread(threadId)
        },
        replyToThread(input) {
            if (!commentController) return { ok: false, error: 'Comments are unavailable' }
            return commentController.replyToThread(input)
        },
        resolveThread(threadId) {
            if (!commentController) return { ok: false, error: 'Comments are unavailable' }
            return commentController.resolveThread(threadId)
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
    }
}
