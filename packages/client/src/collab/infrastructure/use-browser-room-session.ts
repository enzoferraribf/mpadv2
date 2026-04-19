import type { PadRoomSession } from '@/collab/domain/pad-room-session'
import { roomWebSocketUrl } from '@/pad-workspace/infrastructure/browser-pad-api'
import type { PadPath } from '@mpad/core/pad-path'
import { type PadRoomKind, padRoomName } from '@mpad/core/pad-room'
import {
    type ServerRoomMessage,
    applyAwarenessMessage,
    createAwarenessMessage,
    createDocUpdateMessage,
    encodeClientRoomMessage,
    readServerRoomMessage,
    replyToSyncMessage,
} from '@mpad/protocol/room-message-codec'
import { useEffect, useRef, useState } from 'react'
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Doc } from 'yjs'

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

        let active = true
        const doc = new Doc()
        const awareness = new Awareness(doc)
        const roomName = padRoomName(input.path, input.kind)
        const socket = new WebSocket(
            roomWebSocketUrl(roomName, awareness.clientID),
        )
        const sendBytes = (bytes: Uint8Array) => {
            if (socket.readyState !== WebSocket.OPEN) return
            socket.send(bytes)
        }

        const session: PadRoomSession<TKind, TLocalState> = {
            kind: input.kind,
            roomName,
            doc,
            awareness,
            peerId: awareness.clientID,
            status: 'connecting',
            setLocalState(state) {
                awareness.setLocalState(state)
            },
            send(message) {
                sendBytes(encodeClientRoomMessage(message))
            },
            onMessage(listener) {
                listenersRef.current.add(listener)
                return () => listenersRef.current.delete(listener)
            },
        }

        session.setLocalState(input.localState)
        setRoom(session)

        const onDocUpdate = (update: Uint8Array, origin: unknown) => {
            if (origin === 'remote') return
            session.send(createDocUpdateMessage(update))
        }

        const onAwarenessUpdate = (
            change: { added: number[]; updated: number[]; removed: number[] },
            origin: unknown,
        ) => {
            if (origin === 'remote') return
            session.send(
                createAwarenessMessage(awareness, [
                    ...change.added,
                    ...change.updated,
                    ...change.removed,
                ]),
            )
        }

        socket.binaryType = 'arraybuffer'
        socket.onopen = () => {
            if (!active) return
            session.status = 'connected'
            setRoom({ ...session })
            session.send(
                createAwarenessMessage(awareness, [awareness.clientID]),
            )
        }

        socket.onmessage = (event) => {
            if (!active) return
            const message = readServerRoomMessage(readSocketBytes(event.data))

            if (message.kind === 'sync') {
                const reply = replyToSyncMessage(doc, message.data, 'remote')
                if (reply) sendBytes(reply.data)
                return
            }

            if (message.kind === 'awareness') {
                applyAwarenessMessage(awareness, message.data, 'remote')
                return
            }

            for (const listener of listenersRef.current) listener(message)
        }

        socket.onclose = () => {
            if (!active) return
            session.status = 'disconnected'
            setRoom({ ...session })
            const remoteIds = Array.from(awareness.getStates().keys()).filter(
                (id) => id !== awareness.clientID,
            )
            awarenessProtocol.removeAwarenessStates(
                awareness,
                remoteIds,
                'disconnect',
            )
        }

        doc.on('update', onDocUpdate)
        awareness.on('update', onAwarenessUpdate)

        return () => {
            active = false
            session.setLocalState(null)
            sendBytes(
                encodeClientRoomMessage(
                    createAwarenessMessage(awareness, [awareness.clientID]),
                ),
            )
            socket.close()
            doc.off('update', onDocUpdate)
            awareness.off('update', onAwarenessUpdate)
            awareness.destroy()
            doc.destroy()
            listenersRef.current.clear()
            setRoom(null)
        }
    }, [input.kind, input.open, input.path])

    useEffect(() => {
        room?.setLocalState(input.localState)
    }, [input.localState, room])

    return room
}

function readSocketBytes(value: ArrayBuffer | Blob | string) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    if (typeof value === 'string') return new TextEncoder().encode(value)
    throw new Error('Unexpected socket payload')
}
