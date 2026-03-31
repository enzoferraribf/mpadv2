import { Y_TEXT_KEY, type LocalPeer, type PadPath } from '@mmpad/shared'
import { useEffect, useMemo, useState } from 'react'
import type { PadTextRoom, TextAwarenessState, TextAwarenessUser } from '@/pad-session/pad-room-types'
import { createTextAwarenessState } from '@/pad-session/text-awareness'
import { usePadRoomSession } from '@/pad-session/use-pad-room-session'
import { createTextEditorHandle } from '@/pad-text/text-editor-handle'

export type TextPadModel =
    | { kind: 'loading' }
    | {
        kind: 'ready'
        connection: PadTextRoom['status']
        peerCount: number
        content: string
        editor: ReturnType<typeof createTextEditorHandle>
    }

export function useTextPadModel(path: PadPath, localPeer: LocalPeer): TextPadModel {
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
        open: true,
    }) as PadTextRoom | null
    const [content, setContent] = useState('')
    const [peerCount, setPeerCount] = useState(1)

    useEffect(() => {
        if (!room) {
            setContent('')
            setPeerCount(1)
            return
        }

        const ytext = room.doc.getText(Y_TEXT_KEY)
        const syncContent = () => setContent(ytext.toString())
        const syncPeers = () => setPeerCount(room.awareness.getStates().size)

        room.doc.on('update', syncContent)
        room.awareness.on('change', syncPeers)
        syncContent()
        syncPeers()

        return () => {
            room.doc.off('update', syncContent)
            room.awareness.off('change', syncPeers)
        }
    }, [room])

    const editor = useMemo(() => {
        if (!room) return null
        return createTextEditorHandle(room.doc, room.awareness)
    }, [room])

    if (!room || !editor) return { kind: 'loading' }

    return {
        kind: 'ready',
        connection: room.status,
        peerCount,
        content,
        editor,
    }
}
