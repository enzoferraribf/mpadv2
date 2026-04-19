import type { PadPath } from '@mpad/core/pad-path'
import type { PadConnection } from '@mpad/protocol/pad-connection'
import type { LiveFileState } from '@mpad/protocol/live-files'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { useLiveFiles, type LiveFilesModel } from '@/live-files/application/use-live-files'
import { useDrawingPad, type DrawingPadModel } from '@/pad-drawing/application/use-drawing-pad'
import { usePadHistoryWorkspace, type PadHistoryWorkspaceModel } from '@/pad-workspace/application/use-pad-history-workspace'
import {
    usePadWorkspaceView,
    type PadWorkspaceViewCommands,
    type PadWorkspaceViewState,
} from '@/pad-workspace/application/use-pad-workspace-view'
import { useTextWorkspace, type TextWorkspaceModel } from '@/pad-workspace/application/use-text-workspace'
import { loadLocalPeer } from '@/pad-workspace/infrastructure/browser-local-peer-store'
import { useWorkspaceNavigation, type WorkspaceNavigationModel } from '@/pad-workspace/application/use-workspace-navigation'

export type PadWorkspaceShellCommands = PadWorkspaceViewCommands & {
    navigateToPad: (path: PadPath) => void
}

export type PadWorkspaceShellModel = {
    view: PadWorkspaceViewState
    status: {
        connection: PadConnection
        peerCount: number
    }
    commands: PadWorkspaceShellCommands
}

export type PadWorkspaceFilesModel = {
    files: LiveFileState[]
    deleteFile: LiveFilesModel['deleteFile']
    downloadFile: LiveFilesModel['downloadFile']
    uploadFile: LiveFilesModel['uploadFile']
}

export type PadWorkspaceModel = {
    shell: PadWorkspaceShellModel
    text: TextWorkspaceModel
    history: PadHistoryWorkspaceModel
    drawing: DrawingPadModel
    files: PadWorkspaceFilesModel
    navigation: WorkspaceNavigationModel
}

export function usePadWorkspaceModel(path: PadPath): PadWorkspaceModel {
    const navigate = useNavigate()
    const peer = useMemo(loadLocalPeer, [])
    const view = usePadWorkspaceView(path)
    const text = useTextWorkspace(path, peer)
    const drawing = useDrawingPad(path, peer, view.state.activeTab === 'drawing')
    const liveFiles = useLiveFiles(path, peer, view.state.activeTab === 'files' || view.state.dialog === 'files')
    const navigation = useWorkspaceNavigation(path)

    const shellCommands: PadWorkspaceShellCommands = {
        ...view.commands,
        navigateToPad(nextPath) {
            navigate({ to: '/$', params: { _splat: nextPath.slice(1) } })
            view.commands.closeDialog()
        },
    }

    const files: PadWorkspaceFilesModel = {
        files: liveFiles.files,
        deleteFile(id) {
            liveFiles.deleteFile(id)
            toast.success('Local file removed')
        },
        downloadFile(file) {
            liveFiles.downloadFile(file)
        },
        uploadFile(file) {
            liveFiles.uploadFile(file)
        },
    }

    const history = usePadHistoryWorkspace({
        path,
        currentContent: text.kind === 'ready' ? text.content : '',
        open: view.state.activeTab === 'diffs',
        async onRevertToRevision(input) {
            if (text.kind !== 'ready') throw new Error('Text is unavailable')
            return text.revertToRevision(input)
        },
    })

    return {
        shell: {
            view: view.state,
            status: {
                connection: text.kind === 'ready' ? text.connection : 'connecting',
                peerCount: text.kind === 'ready' ? text.peerCount : 0,
            },
            commands: shellCommands,
        },
        text,
        history,
        drawing,
        files,
        navigation,
    }
}
