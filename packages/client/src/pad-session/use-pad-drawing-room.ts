import type { PadPath } from '@mmpad/shared'
import { useMemo } from 'react'
import type { DrawingAwarenessState, DrawingAwarenessUser, LocalPeer, PadDrawingRoom } from './pad-room-types'
import { createDrawingHandle } from '@/pad-drawing/drawing-handle'
import { usePadRoomSession } from './use-pad-room-session'

export type PadDrawingState =
    | { kind: 'closed' }
    | { kind: 'loading'; connection: 'connecting' }
    | {
        kind: 'ready'
        connection: PadDrawingRoom['status']
        drawing: ReturnType<typeof createDrawingHandle>
    }

export function usePadDrawingRoom(path: PadPath, localPeer: LocalPeer, open: boolean) {
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

    if (!open) return { kind: 'closed' } satisfies PadDrawingState
    if (!room) return { kind: 'loading', connection: 'connecting' } satisfies PadDrawingState
    if (!drawing) return { kind: 'loading', connection: 'connecting' } satisfies PadDrawingState

    return {
        kind: 'ready',
        connection: room.status,
        drawing,
    } satisfies PadDrawingState
}
