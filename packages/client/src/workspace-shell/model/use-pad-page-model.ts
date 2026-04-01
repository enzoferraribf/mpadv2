import type { LiveFileState, LocalPeer, PadPath, PadTreeItem } from '@mmpad/shared'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { useDrawingPadModel, type DrawingPadModel } from '@/pad-doc/model/use-drawing-pad-model'
import { useTextPadModel, type TextPadCommentActions, type TextPadComments } from '@/pad-doc/model/use-text-pad-model'
import { loadLocalPeer } from '@/peer/model/local-peer'
import type { CursorPosition, TextEditorHandle, TextEditorSelection } from '@/pad-text/text-editor-handle'
import { usePadTreeModel } from '@/pad-tree/model/use-pad-tree-model'
import type { TextCommentResult } from '@/pad-text/text-comment-controller'
import type { PadConnection } from '@/pad-session/pad-room-types'
import { useFileSessionModel } from '@/file-session/model/use-file-session-model'
import {
    useWorkspaceShell,
    type PadWorkspaceLayout,
    type PadWorkspaceTab,
    type WorkspaceShellActions,
    type WorkspaceShellState,
} from './use-workspace-shell'

export type { PadWorkspaceLayout, PadWorkspaceTab } from './use-workspace-shell'

export type PadPageState =
    | {
        kind: 'loading'
        view: WorkspaceShellState
        status: {
            connection: 'connecting'
            peerCount: 0
            tree: PadTreeItem[]
            files: LiveFileState[]
        }
    }
    | {
        kind: 'ready'
        view: WorkspaceShellState
        status: {
            connection: PadConnection
            peerCount: number
            tree: PadTreeItem[]
            files: LiveFileState[]
        }
        text: {
            content: string
            editor: TextEditorHandle
            comments: TextPadComments
            commentActions: TextPadCommentActions
        }
        drawing: DrawingPadModel
    }

export type PadPageActions = WorkspaceShellActions & {
    closeCommentOverlay: () => void
    createCommentThread: (body: string) => TextCommentResult<{ threadId: string }>
    deleteCommentMessage: (input: { threadId: string; messageId: string }) => TextCommentResult
    deleteCommentThread: (threadId: string) => TextCommentResult
    deleteFile: (id: string) => void
    downloadFile: (file: LiveFileState) => void
    editCommentMessage: (input: { threadId: string; messageId: string; body: string }) => TextCommentResult
    navigateToPad: (path: PadPath) => void
    openCommentDraftFromSelection: () => boolean
    openCommentThread: (threadId: string | null) => void
    replyToCommentThread: (input: { threadId: string; body: string }) => TextCommentResult<{ messageId: string }>
    reopenCommentThread: (threadId: string) => TextCommentResult
    setCommentSelection: (selection: TextEditorSelection | null) => void
    resolveCommentThread: (threadId: string) => TextCommentResult
    uploadFile: (file: File) => void
}

export type PadPageModel = {
    actions: PadPageActions
    state: PadPageState
}

export function usePadPageModel(path: PadPath): PadPageModel {
    const navigate = useNavigate()
    const peer = useMemo(loadLocalPeer, []) as LocalPeer
    const shell = useWorkspaceShell(path)
    const text = useTextPadModel(path, peer)
    const drawing = useDrawingPadModel(path, peer, shell.state.activeTab === 'drawing')
    const tree = usePadTreeModel(path)
    const files = useFileSessionModel(path, peer)

    const actions: PadPageActions = {
        ...shell.actions,
        deleteFile(id) {
            files.deleteFile(id)
            toast.success('Local file removed')
        },
        closeCommentOverlay() {
            if (text.kind === 'loading') return
            text.commentActions.closeOverlay()
        },
        createCommentThread(body) {
            if (text.kind === 'loading') return { ok: false, error: 'Comments are unavailable' }
            return text.commentActions.createThread(body)
        },
        deleteCommentMessage(input) {
            if (text.kind === 'loading') return { ok: false, error: 'Comments are unavailable' }
            return text.commentActions.deleteMessage(input)
        },
        deleteCommentThread(threadId) {
            if (text.kind === 'loading') return { ok: false, error: 'Comments are unavailable' }
            return text.commentActions.deleteThread(threadId)
        },
        downloadFile(file) {
            files.downloadFile(file)
        },
        editCommentMessage(input) {
            if (text.kind === 'loading') return { ok: false, error: 'Comments are unavailable' }
            return text.commentActions.editMessage(input)
        },
        navigateToPad(nextPath) {
            navigate({ to: '/$', params: { _splat: nextPath.slice(1) } })
            shell.actions.closeDialog()
        },
        openCommentDraftFromSelection() {
            if (text.kind === 'loading') return false
            return text.commentActions.openDraftFromSelection()
        },
        openCommentThread(threadId) {
            if (text.kind === 'loading') return
            text.commentActions.openThread(threadId)
        },
        replyToCommentThread(input) {
            if (text.kind === 'loading') return { ok: false, error: 'Comments are unavailable' }
            return text.commentActions.replyToThread(input)
        },
        reopenCommentThread(threadId) {
            if (text.kind === 'loading') return { ok: false, error: 'Comments are unavailable' }
            return text.commentActions.reopenThread(threadId)
        },
        setCommentSelection(selection) {
            if (text.kind === 'loading') return
            text.commentActions.setEditorSelection(selection)
        },
        resolveCommentThread(threadId) {
            if (text.kind === 'loading') return { ok: false, error: 'Comments are unavailable' }
            return text.commentActions.resolveThread(threadId)
        },
        uploadFile(file) {
            files.uploadFile(file)
        },
    }

    if (text.kind === 'loading' || tree.kind === 'loading') {
        return {
            actions,
            state: {
                kind: 'loading',
                view: shell.state,
                status: {
                    connection: 'connecting',
                    peerCount: 0,
                    tree: [],
                    files: [],
                },
            },
        }
    }

    return {
        actions,
        state: {
            kind: 'ready',
            view: shell.state,
            status: {
                connection: text.connection,
                peerCount: text.peerCount,
                tree: tree.items,
                files: files.files,
            },
            text: {
                content: text.content,
                editor: text.editor,
                comments: text.comments,
                commentActions: text.commentActions,
            },
            drawing,
        },
    }
}
