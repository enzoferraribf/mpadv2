import type { ServerWebSocket } from 'bun'
import {
    applyAwarenessMessage,
    createAwarenessMessage,
    createDocUpdateMessage,
    encodeServerRoomMessage,
    parsePadRoomName,
    replyToSyncMessage,
    type ClientRoomMessage,
    type OutboundFileSignal,
    type PadPath,
} from '@mmpad/shared'
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Doc, encodeStateAsUpdate } from 'yjs'
import { assert } from '../shared/assert'
import type { WsData } from '../transport/ws-data'

type LiveFileRoom = {
    roomName: string
    path: PadPath
    kind: 'files'
    doc: Doc
    awareness: Awareness
    clients: Set<ServerWebSocket<WsData>>
}

const rooms = new Map<string, LiveFileRoom>()

export async function joinLiveFileRoom(ws: ServerWebSocket<WsData>) {
    const room = loadLiveFileRoom(ws.data.roomName)
    room.clients.add(ws)
    sendRoomMessage(ws, createDocUpdateMessage(encodeStateAsUpdate(room.doc)))

    const clientIds = Array.from(room.awareness.getStates().keys())
    if (clientIds.length > 0) sendRoomMessage(ws, createAwarenessMessage(room.awareness, clientIds))
}

export async function leaveLiveFileRoom(ws: ServerWebSocket<WsData>) {
    const room = rooms.get(ws.data.roomName)
    if (!room) return

    room.clients.delete(ws)
    awarenessProtocol.removeAwarenessStates(room.awareness, [ws.data.awarenessClientId], null)
    if (room.awareness.meta.has(ws.data.awarenessClientId)) {
        broadcast(room, ws, createAwarenessMessage(room.awareness, [ws.data.awarenessClientId]))
    }

    if (room.clients.size > 0) return

    room.awareness.destroy()
    room.doc.destroy()
    rooms.delete(room.roomName)
}

export function handleLiveFileMessage(ws: ServerWebSocket<WsData>, message: ClientRoomMessage) {
    const room = rooms.get(ws.data.roomName)
    if (!room) return

    if (message.kind === 'sync') {
        handleSyncMessage(room, ws, message.data)
        return
    }

    if (message.kind === 'awareness') {
        handleAwarenessMessage(room, ws, message.data)
        return
    }

    routeLiveFileSignal(room, ws, message.signal)
}

export function routeLiveFileSignal(
    room: Pick<LiveFileRoom, 'clients'>,
    sender: ServerWebSocket<WsData>,
    signal: OutboundFileSignal,
) {
    for (const client of room.clients) {
        if (client.data.awarenessClientId !== signal.targetPeerId) continue
        client.sendBinary(Buffer.from(encodeServerRoomMessage({
            kind: 'file-signal',
            signal: {
                sourcePeerId: sender.data.awarenessClientId,
                signal: signal.signal,
            },
        })))
        return
    }
}

function loadLiveFileRoom(roomName: string) {
    const existing = rooms.get(roomName)
    if (existing) return existing

    const room = parsePadRoomName(roomName)
    assert(room.kind === 'files', 'Live file room must use the files kind')
    const doc = new Doc()

    const nextRoom: LiveFileRoom = {
        roomName,
        path: room.path,
        kind: 'files',
        doc,
        awareness: new Awareness(doc),
        clients: new Set(),
    }

    rooms.set(roomName, nextRoom)
    return nextRoom
}

function handleSyncMessage(room: LiveFileRoom, sender: ServerWebSocket<WsData>, data: Uint8Array) {
    const reply = replyToSyncMessage(room.doc, data, null)
    if (reply) sendRoomMessage(sender, reply)
    broadcast(room, sender, { kind: 'sync', data })
}

function handleAwarenessMessage(room: LiveFileRoom, sender: ServerWebSocket<WsData>, data: Uint8Array) {
    applyAwarenessMessage(room.awareness, data, sender)
    broadcast(room, sender, { kind: 'awareness', data })
}

function broadcast(
    room: LiveFileRoom,
    sender: ServerWebSocket<WsData>,
    message: Extract<ClientRoomMessage, { kind: 'sync' | 'awareness' }>,
) {
    for (const client of room.clients) {
        if (client === sender) continue
        sendRoomMessage(client, message)
    }
}

function sendRoomMessage(
    ws: ServerWebSocket<WsData>,
    message: Extract<ClientRoomMessage, { kind: 'sync' | 'awareness' }>,
) {
    ws.sendBinary(Buffer.from(message.data))
}
