import type { ServerWebSocket } from 'bun'
import {
    applyAwarenessMessage,
    assert,
    createAwarenessMessage,
    createDocUpdateMessage,
    encodeServerRoomMessage,
    parsePadRoomName,
    replyToSyncMessage,
    type AwarenessRoomMessage,
    type ClientRoomMessage,
    type OutboundFileSignal,
    type SyncRoomMessage,
} from '@mmpad/shared'
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Doc, encodeStateAsUpdate } from 'yjs'
import type { WsData } from '../../transport/ws-data'

export type LiveFileRoom = {
    roomName: string
    doc: Doc
    awareness: Awareness
    clients: Set<ServerWebSocket<WsData>>
}

type LiveFileDocReply = {
    reply: SyncRoomMessage | null
    broadcast: SyncRoomMessage | AwarenessRoomMessage
}

type LiveFileSignalRelay = {
    relay: Uint8Array
    targetPeerId: number
}

export function createLiveFileRoom(roomName: string): LiveFileRoom {
    const room = parsePadRoomName(roomName)
    assert(room.kind === 'files', 'Live file room must use the files kind')
    const doc = new Doc()

    return {
        roomName,
        doc,
        awareness: new Awareness(doc),
        clients: new Set(),
    }
}

export function connectLiveFileClient(room: LiveFileRoom, ws: ServerWebSocket<WsData>) {
    room.clients.add(ws)
    const messages: Array<SyncRoomMessage | AwarenessRoomMessage> = [
        createDocUpdateMessage(encodeStateAsUpdate(room.doc)),
    ]
    const clientIds = Array.from(room.awareness.getStates().keys())
    if (clientIds.length > 0) messages.push(createAwarenessMessage(room.awareness, clientIds))
    return messages
}

export function disconnectLiveFileClient(room: LiveFileRoom, ws: ServerWebSocket<WsData>) {
    room.clients.delete(ws)
    awarenessProtocol.removeAwarenessStates(room.awareness, [ws.data.awarenessClientId], null)
    const awarenessMessage = room.awareness.meta.has(ws.data.awarenessClientId)
        ? createAwarenessMessage(room.awareness, [ws.data.awarenessClientId])
        : null

    return {
        awarenessMessage,
        isEmpty: room.clients.size === 0,
    }
}

export function applyLiveFileDocMessage(
    room: LiveFileRoom,
    sender: ServerWebSocket<WsData>,
    message: ClientRoomMessage,
): LiveFileDocReply | LiveFileSignalRelay {
    if (message.kind === 'sync') {
        const reply = replyToSyncMessage(room.doc, message.data, null)
        return {
            reply,
            broadcast: { kind: 'sync', data: message.data } satisfies SyncRoomMessage,
        }
    }

    if (message.kind === 'awareness') {
        applyAwarenessMessage(room.awareness, message.data, sender)
        return {
            reply: null,
            broadcast: { kind: 'awareness', data: message.data } satisfies AwarenessRoomMessage,
        }
    }

    return {
        relay: encodeServerRoomMessage({
            kind: 'file-signal',
            signal: {
                sourcePeerId: sender.data.awarenessClientId,
                signal: message.signal.signal,
            },
        }),
        targetPeerId: message.signal.targetPeerId,
    }
}

export function destroyLiveFileRoom(room: LiveFileRoom) {
    room.awareness.destroy()
    room.doc.destroy()
}

export function routeLiveFileSignal(
    room: Pick<LiveFileRoom, 'clients'>,
    targetPeerId: number,
    relayBytes: Uint8Array,
) {
    for (const client of room.clients) {
        if (client.data.awarenessClientId !== targetPeerId) continue
        client.sendBinary(Buffer.from(relayBytes))
        return
    }
}
