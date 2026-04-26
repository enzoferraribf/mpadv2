import type { OutboundFileSignal } from '@mpad/protocol/live-files'
import {
    type ClientRoomMessage,
    encodeServerRoomMessage,
} from '@mpad/protocol/room-message-codec'
import type { ServerWebSocket } from 'bun'
import type { ServerRuntime } from '#/platform/runtime/runtime'
import type { WsData } from '#/platform/ws/data'
import { sendSocketBytes } from '#/platform/ws/send'
import {
    type LiveFilesRoom,
    applyLiveFilesMessage,
    connectLiveFilesClient,
    createLiveFilesRoom,
    destroyLiveFilesRoom,
    disconnectLiveFilesClient,
    relayLiveFilesSignal,
} from './room'

export async function openLiveFileRoomClient(
    runtime: ServerRuntime,
    socket: ServerWebSocket<WsData>,
) {
    const room = loadLiveFilesRoom(runtime, socket.data.roomName)
    for (const message of connectLiveFilesClient(room, socket)) {
        sendBytes(socket, message.data)
    }
}

export async function closeLiveFileRoomClient(
    runtime: ServerRuntime,
    socket: ServerWebSocket<WsData>,
) {
    const room = runtime.fileRoomRegistry.get(socket.data.roomName)
    if (!room) return

    const result = disconnectLiveFilesClient(room, socket)
    if (result.awarenessMessage)
        broadcast(room, socket, result.awarenessMessage.data)
    if (!result.isEmpty) return

    destroyLiveFilesRoom(room)
    runtime.fileRoomRegistry.delete(room.roomName)
}

export function handleLiveFileRoomMessage(
    runtime: ServerRuntime,
    socket: ServerWebSocket<WsData>,
    message: ClientRoomMessage,
) {
    const room = runtime.fileRoomRegistry.get(socket.data.roomName)
    if (!room) return

    const result = applyLiveFilesMessage(room, socket, message)
    switch (result.kind) {
        case 'noop':
            return
        case 'signal':
            relayLiveFilesSignal(room, result.targetPeerId, result.relayBytes)
            return
        case 'doc':
            if (result.reply) sendBytes(socket, result.reply.data)
            broadcast(room, socket, result.broadcast.data)
            return
    }
}

export function routeLiveFileSignal(
    room: Pick<LiveFilesRoom, 'clients'>,
    sender: ServerWebSocket<WsData>,
    signal: OutboundFileSignal,
) {
    relayLiveFilesSignal(
        room,
        signal.targetPeerId,
        encodeServerRoomMessage({
            kind: 'file-signal',
            signal: {
                sourcePeerId: sender.data.awarenessClientId,
                signal: signal.signal,
            },
        }),
    )
}

function loadLiveFilesRoom(runtime: ServerRuntime, roomName: string) {
    const current = runtime.fileRoomRegistry.get(roomName)
    if (current) return current

    const room = createLiveFilesRoom(roomName)
    runtime.fileRoomRegistry.set(roomName, room)
    return room
}

function broadcast(
    room: LiveFilesRoom,
    sender: ServerWebSocket<WsData>,
    bytes: Uint8Array,
) {
    for (const client of room.clients) {
        if (client === sender) continue
        sendBytes(client, bytes)
    }
}

function sendBytes(socket: ServerWebSocket<WsData>, bytes: Uint8Array) {
    sendSocketBytes(socket, bytes)
}
