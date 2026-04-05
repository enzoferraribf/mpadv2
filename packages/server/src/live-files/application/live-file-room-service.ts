import type { ServerWebSocket } from 'bun'
import {
    encodeServerRoomMessage,
    type ClientRoomMessage,
    type OutboundFileSignal,
} from '@mmpad/shared'
import type { WsData } from '../../transport/ws-data'
import {
    applyLiveFilesMessage,
    connectLiveFilesClient,
    createLiveFilesRoom,
    destroyLiveFilesRoom,
    disconnectLiveFilesClient,
    relayLiveFilesSignal,
    type LiveFilesRoom,
} from './room'

const rooms = new Map<string, LiveFilesRoom>()

export async function openLiveFileRoomClient(ws: ServerWebSocket<WsData>) {
    const room = loadLiveFilesRoom(ws.data.roomName)
    for (const message of connectLiveFilesClient(room, ws)) {
        sendBytes(ws, message.data)
    }
}

export async function closeLiveFileRoomClient(ws: ServerWebSocket<WsData>) {
    const room = rooms.get(ws.data.roomName)
    if (!room) return

    const result = disconnectLiveFilesClient(room, ws)
    if (result.awarenessMessage) broadcast(room, ws, result.awarenessMessage.data)
    if (!result.isEmpty) return

    destroyLiveFilesRoom(room)
    rooms.delete(room.roomName)
}

export function handleLiveFileRoomMessage(ws: ServerWebSocket<WsData>, message: ClientRoomMessage) {
    const room = rooms.get(ws.data.roomName)
    if (!room) return

    const result = applyLiveFilesMessage(room, ws, message)
    if (result.kind === 'signal') {
        relayLiveFilesSignal(room, result.targetPeerId, result.relayBytes)
        return
    }

    if (result.reply) sendBytes(ws, result.reply.data)
    broadcast(room, ws, result.broadcast.data)
}

export function routeLiveFileSignal(
    room: Pick<LiveFilesRoom, 'clients'>,
    sender: ServerWebSocket<WsData>,
    signal: OutboundFileSignal,
) {
    relayLiveFilesSignal(room, signal.targetPeerId, encodeServerRoomMessage({
        kind: 'file-signal',
        signal: {
            sourcePeerId: sender.data.awarenessClientId,
            signal: signal.signal,
        },
    }))
}

function loadLiveFilesRoom(roomName: string) {
    const current = rooms.get(roomName)
    if (current) return current

    const room = createLiveFilesRoom(roomName)
    rooms.set(roomName, room)
    return room
}

function broadcast(room: LiveFilesRoom, sender: ServerWebSocket<WsData>, bytes: Uint8Array) {
    for (const client of room.clients) {
        if (client === sender) continue
        sendBytes(client, bytes)
    }
}

function sendBytes(ws: ServerWebSocket<WsData>, bytes: Uint8Array) {
    ws.sendBinary(Buffer.from(bytes))
}
