import type { LiveFileState, PadPath, PadTreeItem } from '@mmpad/shared'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { useDrawingPadModel, type DrawingPadModel } from '@/pad-doc/model/use-drawing-pad-model'
import { useTextPadModel } from '@/pad-doc/model/use-text-pad-model'
import { loadLocalPeer } from '@/peer/model/local-peer'
import type { CursorPosition, TextEditorHandle } from '@/pad-text/text-editor-handle'
import { usePadTreeModel } from '@/pad-tree/model/use-pad-tree-model'
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
        }
        drawing: DrawingPadModel
    }

export type PadPageActions = WorkspaceShellActions & {
    deleteFile: (id: string) => void
    downloadFile: (file: LiveFileState) => void
    navigateToPad: (path: PadPath) => void
    uploadFile: (file: File) => void
}

export type PadPageModel = {
    actions: PadPageActions
    state: PadPageState
}

export function usePadPageModel(path: PadPath): PadPageModel {
    const navigate = useNavigate()
    const peer = useMemo(loadLocalPeer, [])
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
        downloadFile(file) {
            files.downloadFile(file)
        },
        navigateToPad(nextPath) {
            navigate({ to: '/$', params: { _splat: nextPath.slice(1) } })
            shell.actions.closeDialog()
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
            },
            drawing,
        },
    }
}
