import type { ServerWebSocket } from 'bun'
import {
    encodeServerRoomMessage,
    type ClientRoomMessage,
    type OutboundFileSignal,
} from '@mmpad/shared'
import type { WsData } from '../../transport/ws-data'
import {
    applyLiveFileDocMessage,
    connectLiveFileClient,
    createLiveFileRoom,
    destroyLiveFileRoom,
    disconnectLiveFileClient,
    routeLiveFileSignal as relayLiveFileSignal,
    type LiveFileRoom,
} from './room'

const rooms = new Map<string, LiveFileRoom>()

export async function joinLiveFileRoom(ws: ServerWebSocket<WsData>) {
    const room = loadLiveFileRoom(ws.data.roomName)
    for (const message of connectLiveFileClient(room, ws)) {
        sendRoomMessage(ws, message.data)
    }
}

export async function leaveLiveFileRoom(ws: ServerWebSocket<WsData>) {
    const room = rooms.get(ws.data.roomName)
    if (!room) return

    const result = disconnectLiveFileClient(room, ws)
    if (result.awarenessMessage) broadcast(room, ws, result.awarenessMessage.data)
    if (!result.isEmpty) return

    destroyLiveFileRoom(room)
    rooms.delete(room.roomName)
}

export function handleLiveFileMessage(ws: ServerWebSocket<WsData>, message: ClientRoomMessage) {
    const room = rooms.get(ws.data.roomName)
    if (!room) return

    const result = applyLiveFileDocMessage(room, ws, message)
    if ('relay' in result) {
        relayLiveFileSignal(room, result.targetPeerId, result.relay)
        return
    }

    if (result.reply) sendRoomMessage(ws, result.reply.data)
    broadcast(room, ws, result.broadcast.data)
}

export function routeLiveFileSignal(
    room: Pick<LiveFileRoom, 'clients'>,
    sender: ServerWebSocket<WsData>,
    signal: OutboundFileSignal,
) {
    relayLiveFileSignal(room, signal.targetPeerId, encodeServerRoomMessage({
        kind: 'file-signal',
        signal: {
            sourcePeerId: sender.data.awarenessClientId,
            signal: signal.signal,
        },
    }))
}

function loadLiveFileRoom(roomName: string) {
    const existing = rooms.get(roomName)
    if (existing) return existing

    const room = createLiveFileRoom(roomName)
    rooms.set(roomName, room)
    return room
}

function broadcast(room: LiveFileRoom, sender: ServerWebSocket<WsData>, data: Uint8Array) {
    for (const client of room.clients) {
        if (client === sender) continue
        sendRoomMessage(client, data)
    }
}

function sendRoomMessage(ws: ServerWebSocket<WsData>, data: Uint8Array) {
    ws.sendBinary(Buffer.from(data))
}
