import { Y_TEXT_KEY, type PadPath } from '@mmpad/shared'
import { useEffect, useMemo, useState } from 'react'
import type { LocalPeer, PadTextRoom, TextAwarenessState, TextAwarenessUser } from './pad-room-types'
import { createTextAwarenessState } from './text-awareness'
import { usePadRoomSession } from './use-pad-room-session'

export function usePadTextRoom(path: PadPath, localPeer: LocalPeer) {
    const awarenessUser = useMemo<TextAwarenessUser>(() => ({
        name: localPeer.name,
        color: localPeer.textColor,
        colorLight: localPeer.textColorLight,
    }), [localPeer.name, localPeer.textColor, localPeer.textColorLight])
    const localState = useMemo<TextAwarenessState>(() => createTextAwarenessState(awarenessUser), [awarenessUser])
    const room = usePadRoomSession({
        path,
        kind: 'text',
        localState,
    }) as PadTextRoom | null
    const [textContent, setTextContent] = useState('')
    const [peerCount, setPeerCount] = useState(1)

    useEffect(() => {
        if (!room) {
            setTextContent('')
            setPeerCount(1)
            return
        }

        const ytext = room.doc.getText(Y_TEXT_KEY)
        const onText = () => setTextContent(ytext.toString())
        const onPeers = () => setPeerCount(room.awareness.getStates().size)

        ytext.observe(onText)
        room.awareness.on('change', onPeers)
        onText()
        onPeers()

        return () => {
            ytext.unobserve(onText)
            room.awareness.off('change', onPeers)
        }
    }, [room])

    const textRoom = useMemo<PadTextRoom | null>(() => room, [room])
    if (!textRoom) return null

    return {
        room: textRoom,
        connection: textRoom.status,
        peerCount,
        textContent,
    }
}
