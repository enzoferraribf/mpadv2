import { createTextEditorHandle } from '@/features/text/application/editor'
import { createTextAwarenessState } from '@/features/text/domain/awareness'
import type {
    PadTextRoom,
    TextAwarenessState,
    TextAwarenessUser,
} from '@/shared/realtime/client'
import { useBrowserRoomSession } from '@/shared/realtime/client'
import type { PadPath } from '@mpad/core/pad-path'
import type { LocalPeer } from '@mpad/protocol/peer'
import { useEffect, useMemo, useState } from 'react'

export type TextWorkspaceModel =
    | { kind: 'loading' }
    | {
          kind: 'ready'
          connection: PadTextRoom['status']
          peerCount: number
          editor: ReturnType<typeof createTextEditorHandle>
      }

type TextRoomSnapshot = {
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
        editor,
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

        const syncPeers = () => {
            setSnapshot((value) => ({
                ...value,
                peerCount: room.awareness.getStates().size,
            }))
        }

        room.awareness.on('change', syncPeers)
        syncPeers()

        return () => {
            room.awareness.off('change', syncPeers)
        }
    }, [room])

    return snapshot
}

function createTextRoomSnapshot(): TextRoomSnapshot {
    return {
        peerCount: 0,
    }
}
