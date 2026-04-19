import { assert } from '@mpad/core/assert'
import { parsePadRoomName } from '@mpad/core/pad-room'
import {
    type AwarenessRoomMessage,
    type ClientRoomMessage,
    type SyncRoomMessage,
    applyAwarenessMessage,
    createAwarenessMessage,
    createDocUpdateMessage,
    encodeServerRoomMessage,
    replyToSyncMessage,
} from '@mpad/protocol/room-message-codec'
import type { ServerWebSocket } from 'bun'
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Doc, encodeStateAsUpdate } from 'yjs'
import type { WsData } from '#/transport/ws-data'

export type LiveFilesRoom = {
    roomName: string
    doc: Doc
    awareness: Awareness
    clients: Set<ServerWebSocket<WsData>>
}

type LiveFilesDocResult = {
    kind: 'doc'
    reply: SyncRoomMessage | null
    broadcast: SyncRoomMessage | AwarenessRoomMessage
}

type LiveFilesSignalResult = {
    kind: 'signal'
    targetPeerId: number
    relayBytes: Uint8Array
}

export function createLiveFilesRoom(roomName: string): LiveFilesRoom {
    const room = parsePadRoomName(roomName)
    assert(room.kind === 'files', 'File session room must use the files kind')

    const doc = new Doc()
    return {
        roomName,
        doc,
        awareness: new Awareness(doc),
        clients: new Set(),
    }
}

export function connectLiveFilesClient(
    room: LiveFilesRoom,
    ws: ServerWebSocket<WsData>,
) {
    room.clients.add(ws)

    const messages: Array<SyncRoomMessage | AwarenessRoomMessage> = [
        createDocUpdateMessage(encodeStateAsUpdate(room.doc)),
    ]
    const clientIds = Array.from(room.awareness.getStates().keys())
    if (clientIds.length > 0)
        messages.push(createAwarenessMessage(room.awareness, clientIds))
    return messages
}

export function disconnectLiveFilesClient(
    room: LiveFilesRoom,
    ws: ServerWebSocket<WsData>,
) {
    room.clients.delete(ws)
    awarenessProtocol.removeAwarenessStates(
        room.awareness,
        [ws.data.awarenessClientId],
        null,
    )

    const awarenessMessage = room.awareness.meta.has(ws.data.awarenessClientId)
        ? createAwarenessMessage(room.awareness, [ws.data.awarenessClientId])
        : null

    return {
        awarenessMessage,
        isEmpty: room.clients.size === 0,
    }
}

export function applyLiveFilesMessage(
    room: LiveFilesRoom,
    sender: ServerWebSocket<WsData>,
    message: ClientRoomMessage,
): LiveFilesDocResult | LiveFilesSignalResult {
    if (message.kind === 'sync') {
        return {
            kind: 'doc',
            reply: replyToSyncMessage(room.doc, message.data, null),
            broadcast: { kind: 'sync', data: message.data },
        }
    }

    if (message.kind === 'awareness') {
        applyAwarenessMessage(room.awareness, message.data, sender)
        return {
            kind: 'doc',
            reply: null,
            broadcast: { kind: 'awareness', data: message.data },
        }
    }

    return {
        kind: 'signal',
        targetPeerId: message.signal.targetPeerId,
        relayBytes: encodeServerRoomMessage({
            kind: 'file-signal',
            signal: {
                sourcePeerId: sender.data.awarenessClientId,
                signal: message.signal.signal,
            },
        }),
    }
}

export function destroyLiveFilesRoom(room: LiveFilesRoom) {
    room.awareness.destroy()
    room.doc.destroy()
}

export function relayLiveFilesSignal(
    room: Pick<LiveFilesRoom, 'clients'>,
    targetPeerId: number,
    relayBytes: Uint8Array,
) {
    for (const client of room.clients) {
        if (client.data.awarenessClientId !== targetPeerId) continue
        client.sendBinary(Buffer.from(relayBytes))
        return
    }
}
