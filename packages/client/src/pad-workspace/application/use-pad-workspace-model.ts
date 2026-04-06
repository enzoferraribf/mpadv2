import type { LiveFileState, PadDocRevisionSummary, PadPath, PadTreeItem } from '@mpad/shared'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { useLiveFiles } from '@/live-files/application/use-live-files'
import { useDrawingPad, type DrawingPadModel } from '@/pad-drawing/application/use-drawing-pad'
import { useTextPad, type TextPadCommentActions, type TextPadComments } from '@/pad-text/application/use-text-pad'
import { useWorkspaceNavigation } from '@/pad-workspace/application/use-workspace-navigation'
import {
    usePadWorkspaceView,
    type PadWorkspaceViewCommands,
    type PadWorkspaceViewState,
} from '@/pad-workspace/application/use-pad-workspace-view'
import { loadLocalPeer } from '@/pad-workspace/infrastructure/browser-local-peer-store'
import type { TextCommentResult } from '@/pad-text/infrastructure/text-comment-store'
import type { TextEditorHandle, TextEditorSelection } from '@/pad-text/infrastructure/text-editor'

export type PadWorkspaceState =
    | {
        kind: 'loading'
        view: PadWorkspaceViewState
        status: {
            connection: 'connecting'
            peerCount: 0
            tree: PadTreeItem[]
            files: LiveFileState[]
        }
    }
    | {
        kind: 'ready'
        view: PadWorkspaceViewState
        status: {
            connection: import('@mpad/shared').PadConnection
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

export type PadWorkspaceCommands = PadWorkspaceViewCommands & {
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
    revertTextToRevision: (input: { revisionId: number; revisionNumber: number }) => Promise<PadDocRevisionSummary>
    replyToCommentThread: (input: { threadId: string; body: string }) => TextCommentResult<{ messageId: string }>
    reopenCommentThread: (threadId: string) => TextCommentResult
    setCommentSelection: (selection: TextEditorSelection | null) => void
    resolveCommentThread: (threadId: string) => TextCommentResult
    uploadFile: (file: File) => void
}

export type PadWorkspaceModel = {
    commands: PadWorkspaceCommands
    state: PadWorkspaceState
}

export function usePadWorkspaceModel(path: PadPath): PadWorkspaceModel {
    const navigate = useNavigate()
    const peer = useMemo(loadLocalPeer, [])
    const view = usePadWorkspaceView(path)
    const text = useTextPad(path, peer)
    const drawing = useDrawingPad(path, peer, view.state.activeTab === 'drawing')
    const navigationTree = useWorkspaceNavigation(path)
    const files = useLiveFiles(path, peer, view.state.activeTab === 'files' || view.state.dialog === 'files')

    const commands: PadWorkspaceCommands = {
        ...view.commands,
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
            view.commands.closeDialog()
        },
        openCommentDraftFromSelection() {
            if (text.kind === 'loading') return false
            return text.commentActions.openDraftFromSelection()
        },
        openCommentThread(threadId) {
            if (text.kind === 'loading') return
            text.commentActions.openThread(threadId)
        },
        async revertTextToRevision(input) {
            if (text.kind === 'loading') throw new Error('Text is unavailable')
            return text.revertToRevision(input)
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

    if (text.kind === 'loading' || navigationTree.kind === 'loading') {
        return {
            commands,
            state: {
                kind: 'loading',
                view: view.state,
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
        commands,
        state: {
            kind: 'ready',
            view: view.state,
            status: {
                connection: text.connection,
                peerCount: text.peerCount,
                tree: navigationTree.items,
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
