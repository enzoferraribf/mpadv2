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
    type SyncRoomMessage,
} from '@mmpad/shared'
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Doc, encodeStateAsUpdate } from 'yjs'
import type { WsData } from '../../transport/ws-data'

export type FileSessionRoom = {
    roomName: string
    doc: Doc
    awareness: Awareness
    clients: Set<ServerWebSocket<WsData>>
}

type FileSessionDocResult = {
    kind: 'doc'
    reply: SyncRoomMessage | null
    broadcast: SyncRoomMessage | AwarenessRoomMessage
}

type FileSessionSignalResult = {
    kind: 'signal'
    targetPeerId: number
    relayBytes: Uint8Array
}

export function createFileSessionRoom(roomName: string): FileSessionRoom {
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

export function connectFileSessionClient(room: FileSessionRoom, ws: ServerWebSocket<WsData>) {
    room.clients.add(ws)

    const messages: Array<SyncRoomMessage | AwarenessRoomMessage> = [
        createDocUpdateMessage(encodeStateAsUpdate(room.doc)),
    ]
    const clientIds = Array.from(room.awareness.getStates().keys())
    if (clientIds.length > 0) messages.push(createAwarenessMessage(room.awareness, clientIds))
    return messages
}

export function disconnectFileSessionClient(room: FileSessionRoom, ws: ServerWebSocket<WsData>) {
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

export function applyFileSessionMessage(
    room: FileSessionRoom,
    sender: ServerWebSocket<WsData>,
    message: ClientRoomMessage,
): FileSessionDocResult | FileSessionSignalResult {
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

export function destroyFileSessionRoom(room: FileSessionRoom) {
    room.awareness.destroy()
    room.doc.destroy()
}

export function relayFileSessionSignal(
    room: Pick<FileSessionRoom, 'clients'>,
    targetPeerId: number,
    relayBytes: Uint8Array,
) {
    for (const client of room.clients) {
        if (client.data.awarenessClientId !== targetPeerId) continue
        client.sendBinary(Buffer.from(relayBytes))
        return
    }
}
