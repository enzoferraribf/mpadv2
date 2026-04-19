import type {
    PadTextRoom,
    TextAwarenessState,
    TextAwarenessUser,
} from '@/collab/domain/pad-room-session'
import { useBrowserRoomSession } from '@/collab/infrastructure/use-browser-room-session'
import {
    type PadTextHistoryEntry,
    browserPadTextHistoryCommand,
} from '@/pad-text/infrastructure/browser-pad-text-history'
import { createTextAwarenessState } from '@/pad-text/infrastructure/text-awareness'
import { createTextEditorHandle } from '@/pad-text/infrastructure/text-editor'
import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import type { PadPath } from '@mpad/core/pad-path'
import type { LocalPeer } from '@mpad/protocol/peer'
import { useEffect, useMemo, useState } from 'react'

export type TextWorkspaceModel =
    | { kind: 'loading' }
    | {
          kind: 'ready'
          connection: PadTextRoom['status']
          peerCount: number
          content: string
          editor: ReturnType<typeof createTextEditorHandle>
          revertToRevision: (input: {
              revisionId: number
              revisionNumber: number
          }) => Promise<PadTextHistoryEntry>
      }

type TextRoomSnapshot = {
    content: string
    peerCount: number
}

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

    const editor = useMemo(() => {
        if (!room) return null
        return createTextEditorHandle(room.doc, room.awareness)
    }, [room])

    if (!room || !editor) return { kind: 'loading' }

    return {
        kind: 'ready',
        connection: room.status,
        peerCount: roomSnapshot.peerCount,
        content: roomSnapshot.content,
        editor,
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
                ...value,
                content: ytext.toString(),
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
        peerCount: 0,
    }
}
