import type {
    PadTextRoom,
    TextAwarenessState,
    TextAwarenessUser,
} from '@/collab/domain/pad-room-session'
import { useBrowserRoomSession } from '@/collab/infrastructure/use-browser-room-session'
import {
    type TextCommentOverlay,
    closeMissingOverlayThread,
    readOverlayThread,
} from '@/pad-text/domain/comment-overlay'
import {
    type PadTextHistoryEntry,
    browserPadTextHistoryCommand,
} from '@/pad-text/infrastructure/browser-pad-text-history'
import { createTextAwarenessState } from '@/pad-text/infrastructure/text-awareness'
import {
    type TextCommentHighlight,
    type TextCommentResult,
    type TextCommentThreadView,
    createTextCommentController,
} from '@/pad-text/infrastructure/text-comment-store'
import {
    type TextEditorSelection,
    createTextEditorHandle,
} from '@/pad-text/infrastructure/text-editor'
import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import type { PadPath } from '@mpad/core/pad-path'
import type { LocalPeer } from '@mpad/protocol/peer'
import { useEffect, useMemo, useReducer, useState } from 'react'

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
    deleteMessage: (input: {
        threadId: string
        messageId: string
    }) => TextCommentResult
    deleteThread: (threadId: string) => TextCommentResult
    editMessage: (input: {
        threadId: string
        messageId: string
        body: string
    }) => TextCommentResult
    openDraftFromSelection: () => boolean
    openThread: (threadId: string | null) => void
    replyToThread: (input: {
        threadId: string
        body: string
    }) => TextCommentResult<{ messageId: string }>
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
          revertToRevision: (input: {
              revisionId: number
              revisionNumber: number
          }) => Promise<PadTextHistoryEntry>
      }

type TextRoomSnapshot = {
    content: string
    docVersion: number
    peerCount: number
}

type TextCommentUiState = {
    overlay: TextCommentOverlay
    selection: TextEditorSelection | null
}

type TextCommentUiEvent =
    | { kind: 'overlay-set'; overlay: TextCommentOverlay }
    | { kind: 'room-changed' }
    | { kind: 'selection-set'; selection: TextEditorSelection | null }

export function useTextWorkspace(
    path: PadPath,
    localPeer: LocalPeer,
): TextWorkspaceModel {
    const awarenessUser = useMemo<TextAwarenessUser>(
        () => ({
            name: localPeer.name,
            color: localPeer.textColor,
            colorLight: localPeer.textColorLight,
        }),
        [localPeer.name, localPeer.textColor, localPeer.textColorLight],
    )
    const localState = useMemo<TextAwarenessState>(
        () => createTextAwarenessState(awarenessUser),
        [awarenessUser],
    )
    const room = useBrowserRoomSession({
        path,
        kind: 'text',
        localState,
        open: true,
    }) as PadTextRoom | null
    const roomSnapshot = useTextRoomSnapshot(room)
    const [commentUi, dispatchCommentUi] = useReducer(
        reduceTextCommentUiState,
        undefined,
        createTextCommentUiState,
    )

    const editor = useMemo(() => {
        if (!room) return null
        return createTextEditorHandle(room.doc, room.awareness)
    }, [room])

    const commentController = useMemo(() => {
        if (!room) return null
        return createTextCommentController(room.doc, localPeer)
    }, [localPeer, room])

    useEffect(() => {
        dispatchCommentUi({ kind: 'room-changed' })
    }, [room])

    const threads = useMemo(
        () => commentController?.listThreads() ?? [],
        [commentController, roomSnapshot.docVersion],
    )
    const highlights = useMemo(
        () => commentController?.getHighlightSpans() ?? [],
        [commentController, roomSnapshot.docVersion],
    )
    const currentSelection =
        useMemo<TextWorkspaceCommentSelection | null>(() => {
            if (!commentUi.selection || !commentController) return null
            const result = commentController.validateSelection({
                from: commentUi.selection.from,
                to: commentUi.selection.to,
                quote: commentUi.selection.quote,
            })

            return {
                ...commentUi.selection,
                canCreate: result.ok,
                error: result.ok ? null : result.error,
            }
        }, [commentController, roomSnapshot.docVersion, commentUi.selection])
    const overlayThread = useMemo(
        () => readOverlayThread(commentUi.overlay, threads),
        [commentUi.overlay, threads],
    )

    useEffect(() => {
        const nextOverlay = closeMissingOverlayThread(
            commentUi.overlay,
            threads,
        )
        if (nextOverlay === commentUi.overlay) return
        dispatchCommentUi({ kind: 'overlay-set', overlay: nextOverlay })
    }, [commentUi.overlay, threads])

    useEffect(() => {
        if (commentUi.overlay.kind !== 'draft' || !commentController) return
        const result = commentController.validateSelection(
            commentUi.overlay.selection,
        )
        if (result.ok) return
        dispatchCommentUi({ kind: 'overlay-set', overlay: { kind: 'closed' } })
    }, [commentController, roomSnapshot.docVersion, commentUi.overlay])

    if (!room || !editor || !commentController) return { kind: 'loading' }

    const commentActions: TextWorkspaceCommentActions = {
        closeOverlay() {
            dispatchCommentUi({
                kind: 'overlay-set',
                overlay: { kind: 'closed' },
            })
        },
        createThread(body) {
            if (commentUi.overlay.kind !== 'draft')
                return { ok: false, error: 'Select some text first' }
            const result = commentController.createThread({
                selection: commentUi.overlay.selection,
                body,
            })
            if (result.ok) {
                dispatchCommentUi({
                    kind: 'overlay-set',
                    overlay: {
                        kind: 'thread',
                        threadId: result.value.threadId,
                    },
                })
            }
            return result
        },
        deleteMessage(input) {
            return commentController.deleteMessage(input)
        },
        deleteThread(threadId) {
            const result = commentController.deleteThread(threadId)
            if (
                result.ok &&
                commentUi.overlay.kind === 'thread' &&
                commentUi.overlay.threadId === threadId
            ) {
                dispatchCommentUi({
                    kind: 'overlay-set',
                    overlay: { kind: 'closed' },
                })
            }
            return result
        },
        editMessage(input) {
            return commentController.editMessage(input)
        },
        openDraftFromSelection() {
            if (!currentSelection || !currentSelection.canCreate) return false
            dispatchCommentUi({
                kind: 'overlay-set',
                overlay: {
                    kind: 'draft',
                    selection: {
                        from: currentSelection.from,
                        to: currentSelection.to,
                        quote: currentSelection.quote,
                    },
                },
            })
            return true
        },
        openThread(threadId) {
            if (!threadId) {
                dispatchCommentUi({
                    kind: 'overlay-set',
                    overlay: { kind: 'closed' },
                })
                return
            }
            if (
                commentUi.overlay.kind === 'thread' &&
                commentUi.overlay.threadId === threadId
            )
                return
            dispatchCommentUi({
                kind: 'overlay-set',
                overlay: { kind: 'thread', threadId },
            })
        },
        replyToThread(input) {
            return commentController.replyToThread(input)
        },
        setEditorSelection(selection) {
            dispatchCommentUi({ kind: 'selection-set', selection })
        },
    }

    return {
        kind: 'ready',
        connection: room.status,
        peerCount: roomSnapshot.peerCount,
        content: roomSnapshot.content,
        editor,
        comments: {
            currentSelection,
            highlights,
            overlay: commentUi.overlay,
            overlayThread,
            threads,
        },
        commentActions,
        async revertToRevision(input) {
            if (room.status !== 'connected')
                throw new Error('Text room is not connected')
            return browserPadTextHistoryCommand.revertRevision(
                path,
                input.revisionId,
            )
        },
    }
}

function useTextRoomSnapshot(room: PadTextRoom | null) {
    const [snapshot, setSnapshot] = useState<TextRoomSnapshot>(
        createTextRoomSnapshot,
    )

    useEffect(() => {
        if (!room) {
            setSnapshot(createTextRoomSnapshot())
            return
        }

        const ytext = room.doc.getText(Y_TEXT_KEY)
        const syncDocument = () => {
            setSnapshot((value) => ({
                content: ytext.toString(),
                docVersion: value.docVersion + 1,
                peerCount: value.peerCount,
            }))
        }
        const syncPeers = () => {
            setSnapshot((value) => ({
                ...value,
                peerCount: room.awareness.getStates().size,
            }))
        }

        room.doc.on('update', syncDocument)
        room.awareness.on('change', syncPeers)
        syncDocument()
        syncPeers()

        return () => {
            room.doc.off('update', syncDocument)
            room.awareness.off('change', syncPeers)
        }
    }, [room])

    return snapshot
}

function createTextRoomSnapshot(): TextRoomSnapshot {
    return {
        content: '',
        docVersion: 0,
        peerCount: 1,
    }
}

function createTextCommentUiState(): TextCommentUiState {
    return {
        overlay: { kind: 'closed' },
        selection: null,
    }
}

function reduceTextCommentUiState(
    state: TextCommentUiState,
    event: TextCommentUiEvent,
): TextCommentUiState {
    switch (event.kind) {
        case 'overlay-set':
            return {
                ...state,
                overlay: event.overlay,
            }
        case 'room-changed':
            return createTextCommentUiState()
        case 'selection-set':
            return {
                ...state,
                selection: event.selection,
            }
    }
}
