import { roomWebSocketUrl } from '@/shared/realtime/application/api'
import type { PadRoomSession } from '@/shared/realtime/domain/model'
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
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Doc } from 'yjs'

const HEARTBEAT_INTERVAL_MS = 20_000
const RECONNECT_DELAY_MS = 1_000

export type BrowserRoomInput<
    TKind extends PadRoomKind,
    TLocalState extends object,
> = {
    path: PadPath
    kind: TKind
    localState: TLocalState
}

export function openBrowserRoom<
    TKind extends PadRoomKind,
    TLocalState extends object,
>(
    input: BrowserRoomInput<TKind, TLocalState>,
    listeners: Set<(message: ServerRoomMessage) => void>,
    publish: (room: PadRoomSession<TKind, TLocalState> | null) => void,
) {
    const doc = new Doc()
    const awareness = new Awareness(doc)
    const queuedBytes: Uint8Array[] = []
    const roomName = padRoomName(input.path, input.kind)
    const state = createSocketState()

    const sendBytes = (bytes: Uint8Array) => {
        if (state.socket?.readyState === WebSocket.OPEN) {
            state.socket.send(bytes)
            return
        }
        if (state.closing || state.socket?.readyState !== WebSocket.CONNECTING)
            return
        queuedBytes.push(bytes)
    }

    const session = createSession(input.kind, roomName, doc, awareness, {
        listen(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        sendBytes,
    })

    const publishStatus = (
        status: PadRoomSession<TKind, TLocalState>['status'],
        connectionError = session.connectionError,
    ) => {
        session.status = status
        session.connectionError = connectionError
        publish({ ...session })
    }

    const clearHeartbeat = () => {
        if (state.heartbeatId === null) return
        window.clearInterval(state.heartbeatId)
        state.heartbeatId = null
    }

    const clearReconnect = () => {
        if (state.reconnectId === null) return
        window.clearTimeout(state.reconnectId)
        state.reconnectId = null
    }

    const startHeartbeat = () => {
        clearHeartbeat()
        state.heartbeatId = window.setInterval(() => {
            session.send({ kind: 'heartbeat' })
        }, HEARTBEAT_INTERVAL_MS)
    }

    const reconnect = () => {
        clearReconnect()
        if (!state.active || state.closing) return
        publishStatus('connecting')
        state.reconnectId = window.setTimeout(connect, RECONNECT_DELAY_MS)
    }

    const handleOpen = () => {
        if (!state.active) return
        publishStatus('connected', null)
        flushQueuedBytes(state, queuedBytes)
        startHeartbeat()
        session.send(createAwarenessMessage(awareness, [awareness.clientID]))
    }

    const handleMessage = (event: MessageEvent) => {
        if (!state.active) return
        routeServerMessage({
            awareness,
            doc,
            listeners,
            message: readServerRoomMessage(readSocketBytes(event.data)),
            sendBytes,
        })
    }

    const handleClose = (event: CloseEvent) => {
        if (!state.active) return
        clearHeartbeat()
        publishStatus(
            'disconnected',
            readCloseError(event, session.connectionError),
        )
        removeRemoteAwareness(awareness)
        reconnect()
    }

    function connect() {
        if (!state.active || state.closing) return
        state.socket = new WebSocket(
            roomWebSocketUrl(roomName, awareness.clientID),
        )
        state.socket.binaryType = 'arraybuffer'
        state.socket.onopen = handleOpen
        state.socket.onmessage = handleMessage
        state.socket.onclose = handleClose
        state.socket.onerror = () => {
            state.socket?.close()
        }
    }

    const offDocSync = bindDocSync(doc, awareness, session)
    session.setLocalState(input.localState)
    publish(session)
    connect()

    return {
        close() {
            state.active = false
            state.closing = true
            clearHeartbeat()
            clearReconnect()
            session.setLocalState(null)
            queuedBytes.length = 0
            state.socket?.close()
            offDocSync()
            awareness.destroy()
            doc.destroy()
            listeners.clear()
            publish(null)
        },
    }
}

function createSocketState() {
    return {
        active: true,
        closing: false,
        heartbeatId: null as number | null,
        reconnectId: null as number | null,
        socket: null as WebSocket | null,
    }
}

function flushQueuedBytes(
    state: ReturnType<typeof createSocketState>,
    queuedBytes: Uint8Array[],
) {
    while (
        queuedBytes.length > 0 &&
        state.socket?.readyState === WebSocket.OPEN
    ) {
        const bytes = queuedBytes.shift()
        if (bytes) state.socket.send(bytes)
    }
}

function createSession<TKind extends PadRoomKind, TLocalState extends object>(
    kind: TKind,
    roomName: string,
    doc: Doc,
    awareness: Awareness,
    io: {
        listen: (listener: (message: ServerRoomMessage) => void) => () => void
        sendBytes: (bytes: Uint8Array) => void
    },
): PadRoomSession<TKind, TLocalState> {
    return {
        kind,
        roomName,
        doc,
        awareness,
        peerId: awareness.clientID,
        status: 'connecting',
        connectionError: null,
        setLocalState(state) {
            awareness.setLocalState(state)
        },
        send(message) {
            io.sendBytes(encodeClientRoomMessage(message))
        },
        onMessage(listener) {
            return io.listen(listener)
        },
    }
}

function bindDocSync<TKind extends PadRoomKind, TLocalState extends object>(
    doc: Doc,
    awareness: Awareness,
    session: PadRoomSession<TKind, TLocalState>,
) {
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

    doc.on('update', onDocUpdate)
    awareness.on('update', onAwarenessUpdate)

    return () => {
        doc.off('update', onDocUpdate)
        awareness.off('update', onAwarenessUpdate)
    }
}

function routeServerMessage(input: {
    awareness: Awareness
    doc: Doc
    listeners: Set<(message: ServerRoomMessage) => void>
    message: ServerRoomMessage
    sendBytes: (bytes: Uint8Array) => void
}) {
    switch (input.message.kind) {
        case 'sync': {
            const reply = replyToSyncMessage(
                input.doc,
                input.message.data,
                'remote',
            )
            if (reply) input.sendBytes(reply.data)
            return
        }
        case 'awareness':
            applyAwarenessMessage(input.awareness, input.message.data, 'remote')
            return
        case 'file-signal':
            for (const listener of input.listeners) listener(input.message)
            return
    }
}

function removeRemoteAwareness(awareness: Awareness) {
    const remoteIds = Array.from(awareness.getStates().keys()).filter(
        (id) => id !== awareness.clientID,
    )
    awarenessProtocol.removeAwarenessStates(awareness, remoteIds, 'disconnect')
}

function readCloseError(event: CloseEvent, fallback: string | null) {
    if (event.wasClean && event.code === 1000) return null
    if (event.reason.trim()) return event.reason
    if (event.code === 1006) return fallback ?? 'Connection lost'
    return `Connection closed (${event.code})`
}

function readSocketBytes(value: ArrayBuffer | Blob | string) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    if (typeof value === 'string') return new TextEncoder().encode(value)
    throw new Error('Unexpected socket payload')
}
