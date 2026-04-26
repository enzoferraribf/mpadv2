import { createDrawingHandle } from '@/features/drawing/application/handle'
import type {
    DrawingAwarenessState,
    DrawingAwarenessUser,
    PadDrawingRoom,
} from '@/shared/realtime/client'
import { useBrowserRoomSession } from '@/shared/realtime/client'
import type { PadPath } from '@mpad/core/pad-path'
import type { LocalPeer } from '@mpad/protocol/peer'
import { useMemo } from 'react'

export type DrawingPadModel =
    | { kind: 'closed' }
    | { kind: 'loading'; connection: 'connecting' }
    | {
          kind: 'ready'
          connection: PadDrawingRoom['status']
          drawing: ReturnType<typeof createDrawingHandle>
      }

export function useDrawingPad(
    path: PadPath,
    localPeer: LocalPeer,
    open: boolean,
): DrawingPadModel {
    const awarenessUser = useMemo<DrawingAwarenessUser>(
        () => ({
            name: localPeer.name,
            color: localPeer.color,
        }),
        [localPeer.color, localPeer.name],
    )
    const localState = useMemo<DrawingAwarenessState>(
        () => ({
            user: awarenessUser,
            pointer: null,
            button: 'up',
        }),
        [awarenessUser],
    )
    const room = useBrowserRoomSession({
        path,
        kind: 'drawing',
        localState,
        open,
    }) as PadDrawingRoom | null
    const drawing = useMemo(() => {
        if (!room) return null
        return createDrawingHandle(room.doc, room.awareness)
    }, [room])

    if (!open) return { kind: 'closed' }
    if (!room || !drawing) return { kind: 'loading', connection: 'connecting' }

    return {
        kind: 'ready',
        connection: room.status,
        drawing,
    }
}
