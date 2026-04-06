import type { ServerWebSocket } from 'bun'
import {
    CHECKPOINT_INTERVAL,
    PERSIST_DEBOUNCE_MS,
} from '@mpad/core/pad-limits'
import { assert } from '@mpad/core/assert'
import { padRoomName, parsePadRoomName, type PadDocKind } from '@mpad/core/pad-room'
import type { PadPath } from '@mpad/core/pad-path'
import { createDocUpdateMessage, type ClientRoomMessage } from '@mpad/protocol/room-message-codec'
import { restoreTextDocFromUpdate } from '@mpad/text-core/text-revert'
import { mergeUpdates } from 'yjs'
import { appContext } from '../../bootstrap/app-context'
import { ensurePad } from '../../pad-tree/infrastructure/repository'
import type { WsData } from '../../transport/ws-data'
import {
    applyPadDocAwareness,
    applyPadDocSync,
    connectPadDocClient,
    createPadDocRoom,
    destroyPadDocRoom,
    disconnectPadDocClient,
    readPadDocSnapshotBytes,
    takePadDocUpdates,
    type PadDocRoom,
} from './doc-room'

export async function joinPadDocRoom(ws: ServerWebSocket<WsData>) {
    const room = await loadPadDocRoom(ws.data.roomName)
    for (const message of connectPadDocClient(room, ws)) {
        sendRoomMessage(ws, message)
    }
}

export async function leavePadDocRoom(ws: ServerWebSocket<WsData>) {
    const room = appContext.docRoomRegistry.get(ws.data.roomName)
    if (!room) return

    const result = disconnectPadDocClient(room, ws)
    if (result.awarenessMessage) broadcast(room, ws, result.awarenessMessage)
    if (!result.isEmpty) return

    await flushPadDocRoom(room)
    destroyPadDocRoom(room)
    appContext.docRoomRegistry.delete(room.roomName)
}

export function handlePadDocMessage(ws: ServerWebSocket<WsData>, message: ClientRoomMessage) {
    const room = appContext.docRoomRegistry.get(ws.data.roomName)
    if (!room) return

    if (message.kind === 'sync') {
        const result = applyPadDocSync(room, message.data)
        if (result.reply) sendRoomMessage(ws, result.reply)
        broadcast(room, ws, result.broadcast)
        return
    }

    if (message.kind === 'awareness') {
        broadcast(room, ws, applyPadDocAwareness(room, ws, message.data))
        return
    }

    throw new Error(`Pad doc room does not accept ${message.kind}`)
}

export async function flushPadDocRooms() {
    await Promise.all(Array.from(appContext.docRoomRegistry.values(), (room) => flushPadDocRoom(room)))
}

export function getPadDocRoom(roomName: string) {
    return appContext.docRoomRegistry.get(roomName)
}

export async function revertPadDocRoomToUpdate(input: {
    path: PadPath
    kind: PadDocKind
    revertedFromRevisionId: number
    revertedFromRevisionNumber: number
    update: Uint8Array
}) {
    const room = await loadPadDocRoom(padRoomName(input.path, input.kind))
    const captured: Uint8Array[] = []
    const capture = (update: Uint8Array, origin: unknown) => {
        if (origin === 'server-revert') captured.push(update)
    }

    if (room.flushTimer) clearTimeout(room.flushTimer)
    room.flushTimer = null
    room.pendingUpdates = []

    room.doc.on('update', capture)

    try {
        if (input.kind === 'text') restoreTextDocFromUpdate(room.doc, input.update, 'server-revert')
        else throw new Error(`Unsupported revert kind: ${input.kind}`)
    } finally {
        room.doc.off('update', capture)
    }

    if (room.flushTimer) clearTimeout(room.flushTimer)
    room.flushTimer = null

    if (captured.length === 0) {
        return {
            changed: false as const,
            revision: null,
        }
    }

    const flushed = await flushPadDocRoom(room, input.revertedFromRevisionId)
    assert(flushed !== null, 'Expected revert flush to create a revision')
    broadcastAll(room, createDocUpdateMessage(mergeUpdates(captured)))

    return {
        changed: true as const,
        revision: {
            id: flushed.revisionId,
            revisionNumber: flushed.revisionNumber,
            createdAt: flushed.createdAt,
            isHead: true,
            revertedFromRevisionNumber: input.revertedFromRevisionNumber,
        },
    }
}

async function loadPadDocRoom(roomName: string) {
    const existing = appContext.docRoomRegistry.get(roomName)
    if (existing) return existing

    const parsedRoom = parsePadRoomName(roomName)
    assert(parsedRoom.kind !== 'files', 'File rooms do not persist pad docs')
    await ensurePad(parsedRoom.path)

    const stored = await appContext.docRepository.loadDoc(parsedRoom.path, parsedRoom.kind)
    const room = createPadDocRoom({
        roomName,
        path: parsedRoom.path,
        kind: parsedRoom.kind,
        stored,
        onDocumentChanged() {
            scheduleFlush(room)
        },
    })

    appContext.docRoomRegistry.set(roomName, room)
    return room
}

function broadcast(room: PadDocRoom, sender: ServerWebSocket<WsData>, message: { kind: 'sync' | 'awareness'; data: Uint8Array }) {
    for (const client of room.clients) {
        if (client === sender) continue
        sendRoomMessage(client, message)
    }
}

function broadcastAll(room: PadDocRoom, message: { data: Uint8Array }) {
    for (const client of room.clients) sendRoomMessage(client, message)
}

function scheduleFlush(room: PadDocRoom) {
    if (room.flushTimer) clearTimeout(room.flushTimer)
    room.flushTimer = setTimeout(() => {
        room.flushTimer = null
        void flushPadDocRoom(room)
    }, PERSIST_DEBOUNCE_MS)
}

async function flushPadDocRoom(room: PadDocRoom, revertedFromRevisionId: number | null = null) {
    const updates = takePadDocUpdates(room)
    if (updates.length === 0) return null

    const result = await appContext.docRepository.appendRevision(
        room.path,
        room.kind,
        mergeUpdates(updates),
        updates.length,
        revertedFromRevisionId,
    )
    room.latestChunkSeq = result.chunkSeq
    room.headRevisionId = result.revisionId
    room.headRevisionNumber = result.revisionNumber
    room.docBytes = readPadDocSnapshotBytes(room).byteLength

    if (result.revisionNumber % CHECKPOINT_INTERVAL !== 0) return result

    const snapshot = readPadDocSnapshotBytes(room)
    await appContext.docRepository.createCheckpoint(room.path, room.kind, result.revisionId, result.chunkSeq, snapshot)
    room.docBytes = snapshot.byteLength
    return result
}

function sendRoomMessage(ws: ServerWebSocket<WsData>, message: { data: Uint8Array }) {
    ws.sendBinary(Buffer.from(message.data))
}

export const listPadDocRevisions = appContext.docRepository.listRevisions
export const readPadDocRevisionText = appContext.docRepository.readRevisionText
