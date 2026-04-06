import type { ServerWebSocket } from 'bun'
import {
    applyAwarenessMessage,
    createAwarenessMessage,
    createDocUpdateMessage,
    replyToSyncMessage,
} from '@mpad/protocol/room-message-codec'
import { assert } from '@mpad/core/assert'
import { MAX_DRAWING_BYTES, MAX_TEXT_BYTES } from '@mpad/core/pad-limits'
import { type PadDocKind } from '@mpad/core/pad-room'
import type { PadPath } from '@mpad/core/pad-path'
import type { AwarenessRoomMessage, SyncRoomMessage } from '@mpad/protocol/room-message-codec'
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs'
import type { WsData } from '../../transport/ws-data'
import type { StoredPadDoc } from '../../pad-doc/domain/doc-repository'

const DOC_SIZE_PROBE_MARGIN_BYTES = 64 * 1024

export type PadDocRoom = {
    roomName: string
    path: PadPath
    kind: PadDocKind
    doc: Doc
    awareness: Awareness
    clients: Set<ServerWebSocket<WsData>>
    pendingUpdates: Uint8Array[]
    latestChunkSeq: number
    headRevisionId: number | null
    headRevisionNumber: number
    flushTimer: ReturnType<typeof setTimeout> | null
    docBytes: number
}

export function createPadDocRoom(input: {
    roomName: string
    path: PadPath
    kind: PadDocKind
    stored: StoredPadDoc
    onDocumentChanged: () => void
}): PadDocRoom {
    const doc = new Doc()

    if (input.stored.snapshot) applyUpdate(doc, input.stored.snapshot)
    for (const update of input.stored.updates) applyUpdate(doc, update)

    const room: PadDocRoom = {
        roomName: input.roomName,
        path: input.path,
        kind: input.kind,
        doc,
        awareness: new Awareness(doc),
        clients: new Set(),
        pendingUpdates: [],
        latestChunkSeq: input.stored.latestChunkSeq,
        headRevisionId: input.stored.headRevisionId,
        headRevisionNumber: input.stored.headRevisionNumber,
        flushTimer: null,
        docBytes: encodeStateAsUpdate(doc).byteLength,
    }

    doc.on('update', (update: Uint8Array) => {
        room.pendingUpdates.push(update)
        input.onDocumentChanged()
    })

    return room
}

export function connectPadDocClient(room: PadDocRoom, ws: ServerWebSocket<WsData>) {
    room.clients.add(ws)
    const messages: Array<SyncRoomMessage | AwarenessRoomMessage> = [
        createDocUpdateMessage(encodeStateAsUpdate(room.doc)),
    ]
    const clientIds = Array.from(room.awareness.getStates().keys())
    if (clientIds.length > 0) messages.push(createAwarenessMessage(room.awareness, clientIds))
    return messages
}

export function disconnectPadDocClient(room: PadDocRoom, ws: ServerWebSocket<WsData>) {
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

export function applyPadDocSync(room: PadDocRoom, data: Uint8Array) {
    const docBytes = nextDocBytes(room, data)
    assertDocWithinLimit(room, docBytes)
    room.docBytes = docBytes
    const reply = replyToSyncMessage(room.doc, data, null)
    return {
        reply,
        broadcast: { kind: 'sync', data } satisfies SyncRoomMessage,
    }
}

export function applyPadDocAwareness(room: PadDocRoom, sender: ServerWebSocket<WsData>, data: Uint8Array) {
    applyAwarenessMessage(room.awareness, data, sender)
    return { kind: 'awareness', data } satisfies AwarenessRoomMessage
}

export function takePadDocUpdates(room: PadDocRoom) {
    const updates = room.pendingUpdates
    room.pendingUpdates = []
    return updates
}

export function destroyPadDocRoom(room: PadDocRoom) {
    if (room.flushTimer) clearTimeout(room.flushTimer)
    room.awareness.destroy()
    room.doc.destroy()
}

export function readPadDocSnapshotBytes(room: PadDocRoom) {
    return encodeStateAsUpdate(room.doc)
}

function assertDocWithinLimit(room: PadDocRoom, docBytes: number) {
    const limit = room.kind === 'text' ? MAX_TEXT_BYTES : MAX_DRAWING_BYTES
    assert(docBytes <= limit, `${room.kind} document exceeds size limit`)
}

function nextDocBytes(room: PadDocRoom, data: Uint8Array) {
    const limit = room.kind === 'text' ? MAX_TEXT_BYTES : MAX_DRAWING_BYTES
    const projectedBytes = room.docBytes + data.byteLength
    if (projectedBytes < limit - DOC_SIZE_PROBE_MARGIN_BYTES) return projectedBytes
    return probeDocBytes(room.doc, data)
}

function probeDocBytes(doc: Doc, data: Uint8Array) {
    const probe = new Doc()
    applyUpdate(probe, encodeStateAsUpdate(doc))
    replyToSyncMessage(probe, data, null)
    const bytes = encodeStateAsUpdate(probe).byteLength
    probe.destroy()
    return bytes
}
