import type { LocalPeer, PadPath } from '@mmpad/shared'
import { useMemo } from 'react'
import type { DrawingAwarenessState, DrawingAwarenessUser, PadDrawingRoom } from '@/pad-session/pad-room-types'
import { usePadRoomSession } from '@/pad-session/use-pad-room-session'
import { createDrawingHandle } from '@/pad-drawing/drawing-handle'

export type DrawingPadModel =
    | { kind: 'closed' }
    | { kind: 'loading'; connection: 'connecting' }
    | {
        kind: 'ready'
        connection: PadDrawingRoom['status']
        drawing: ReturnType<typeof createDrawingHandle>
    }

export function useDrawingPadModel(path: PadPath, localPeer: LocalPeer, open: boolean): DrawingPadModel {
    const awarenessUser = useMemo<DrawingAwarenessUser>(() => ({
        name: localPeer.name,
        color: localPeer.color,
    }), [localPeer.color, localPeer.name])
    const localState = useMemo<DrawingAwarenessState>(() => ({
        user: awarenessUser,
        pointer: null,
        button: 'up',
    }), [awarenessUser])
    const room = usePadRoomSession({
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
