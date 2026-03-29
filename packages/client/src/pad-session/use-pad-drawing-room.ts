import type { PadPath } from '@mmpad/shared'
import { useMemo } from 'react'
import type { DrawingAwarenessState, DrawingAwarenessUser, LocalPeer, PadDrawingRoom } from './pad-room-types'
import { usePadRoomSession } from './use-pad-room-session'

export function usePadDrawingRoom(path: PadPath, localPeer: LocalPeer, open: boolean) {
    const awarenessUser = useMemo<DrawingAwarenessUser>(() => ({
        name: localPeer.name,
        color: localPeer.color,
    }), [localPeer.color, localPeer.name])
    const localState = useMemo<DrawingAwarenessState>(() => ({ user: awarenessUser }), [awarenessUser])
    return usePadRoomSession({
        path,
        kind: 'drawing',
        localState,
        open,
    }) as PadDrawingRoom | null
}
