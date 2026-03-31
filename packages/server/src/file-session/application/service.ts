import type { ServerWebSocket } from 'bun'
import {
    encodeServerRoomMessage,
    type ClientRoomMessage,
    type OutboundFileSignal,
} from '@mmpad/shared'
import type { WsData } from '../../transport/ws-data'
import {
    applyFileSessionMessage,
    connectFileSessionClient,
    createFileSessionRoom,
    destroyFileSessionRoom,
    disconnectFileSessionClient,
    relayFileSessionSignal,
    type FileSessionRoom,
} from './room'

const rooms = new Map<string, FileSessionRoom>()

export async function openFileSessionClient(ws: ServerWebSocket<WsData>) {
    const room = loadFileSessionRoom(ws.data.roomName)
    for (const message of connectFileSessionClient(room, ws)) {
        sendBytes(ws, message.data)
    }
}

export async function closeFileSessionClient(ws: ServerWebSocket<WsData>) {
    const room = rooms.get(ws.data.roomName)
    if (!room) return

    const result = disconnectFileSessionClient(room, ws)
    if (result.awarenessMessage) broadcast(room, ws, result.awarenessMessage.data)
    if (!result.isEmpty) return

    destroyFileSessionRoom(room)
    rooms.delete(room.roomName)
}

export function applyFileSessionClientMessage(ws: ServerWebSocket<WsData>, message: ClientRoomMessage) {
    const room = rooms.get(ws.data.roomName)
    if (!room) return

    const result = applyFileSessionMessage(room, ws, message)
    if (result.kind === 'signal') {
        relayFileSessionSignal(room, result.targetPeerId, result.relayBytes)
        return
    }

    if (result.reply) sendBytes(ws, result.reply.data)
    broadcast(room, ws, result.broadcast.data)
}

export function routeLiveFileSignal(
    room: Pick<FileSessionRoom, 'clients'>,
    sender: ServerWebSocket<WsData>,
    signal: OutboundFileSignal,
) {
    relayFileSessionSignal(room, signal.targetPeerId, encodeServerRoomMessage({
        kind: 'file-signal',
        signal: {
            sourcePeerId: sender.data.awarenessClientId,
            signal: signal.signal,
        },
    }))
}

function loadFileSessionRoom(roomName: string) {
    const current = rooms.get(roomName)
    if (current) return current

    const room = createFileSessionRoom(roomName)
    rooms.set(roomName, room)
    return room
}

function broadcast(room: FileSessionRoom, sender: ServerWebSocket<WsData>, bytes: Uint8Array) {
    for (const client of room.clients) {
        if (client === sender) continue
        sendBytes(client, bytes)
    }
}

function sendBytes(ws: ServerWebSocket<WsData>, bytes: Uint8Array) {
    ws.sendBinary(Buffer.from(bytes))
}
