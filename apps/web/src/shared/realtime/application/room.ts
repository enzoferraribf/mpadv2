import { openBrowserRoom } from '@/shared/realtime/application/browser-room-runtime'
import type { PadRoomSession } from '@/shared/realtime/domain/model'
import type { PadPath } from '@mpad/core/pad-path'
import type { PadRoomKind } from '@mpad/core/pad-room'
import type { ServerRoomMessage } from '@mpad/protocol/room-message-codec'
import { useEffect, useRef, useState } from 'react'

type UseBrowserRoomSessionInput<
    TKind extends PadRoomKind,
    TLocalState extends object,
> = {
    path: PadPath
    kind: TKind
    localState: TLocalState
    open: boolean
}

export function useBrowserRoomSession<
    TKind extends PadRoomKind,
    TLocalState extends object,
>(input: UseBrowserRoomSessionInput<TKind, TLocalState>) {
    const [room, setRoom] = useState<PadRoomSession<TKind, TLocalState> | null>(
        null,
    )
    const listenersRef = useRef(new Set<(message: ServerRoomMessage) => void>())

    useEffect(() => {
        if (!input.open) {
            setRoom(null)
            return
        }

        const runtime = openBrowserRoom(input, listenersRef.current, setRoom)
        return runtime.close
    }, [input.kind, input.open, input.path])

    useEffect(() => {
        room?.setLocalState(input.localState)
    }, [input.localState, room])

    return room
}
