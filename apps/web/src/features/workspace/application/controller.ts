import {
    type DrawingPadModel,
    useDrawingPad,
} from '@/features/drawing/application/model'
import { type TextWorkspaceModel, useTextWorkspace } from '@/features/text'
import {
    type WorkspaceNavigationModel,
    useWorkspaceNavigation,
} from '@/features/tree'
import {
    type PadWorkspaceViewCommands,
    type PadWorkspaceViewState,
    usePadWorkspaceView,
} from '@/features/workspace/application/view-model'
import { loadLocalPeer } from '@/shared/realtime/client'
import type { PadPath } from '@mpad/core/pad-path'
import type { PadConnection } from '@mpad/protocol/pad-connection'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'

export type PadWorkspaceShellCommands = PadWorkspaceViewCommands & {
    navigateToPad: (path: PadPath) => void
}

export type PadWorkspaceShellModel = {
    view: PadWorkspaceViewState
    status: {
        connection: PadConnection
        connectionError: string | null
        peerCount: number
    }
    commands: PadWorkspaceShellCommands
}

export type PadWorkspaceModel = {
    shell: PadWorkspaceShellModel
    text: TextWorkspaceModel
    drawing: DrawingPadModel
    navigation: WorkspaceNavigationModel
}

export type PadPageController = PadWorkspaceModel

export function usePadPageController(path: PadPath): PadPageController {
    const navigate = useNavigate()
    const peer = useMemo(loadLocalPeer, [])
    const view = usePadWorkspaceView(path)
    const text = useTextWorkspace(path, peer)
    const drawing = useDrawingPad(
        path,
        peer,
        view.state.activeTab === 'drawing',
    )
    const navigation = useWorkspaceNavigation(path)

    const shellCommands: PadWorkspaceShellCommands = {
        ...view.commands,
        navigateToPad(nextPath) {
            navigate({ to: '/$', params: { _splat: nextPath.slice(1) } })
            view.commands.closeDialog()
        },
    }

    return {
        shell: {
            view: view.state,
            status: {
                connection:
                    text.kind === 'ready' ? text.connection : 'connecting',
                connectionError:
                    text.kind === 'ready' ? text.connectionError : null,
                peerCount: text.kind === 'ready' ? text.peerCount : 0,
            },
            commands: shellCommands,
        },
        text,
        drawing,
        navigation,
    }
}

export const usePadWorkspaceModel = usePadPageController
