import type { ServerWebSocket } from 'bun'
import {
    CHECKPOINT_INTERVAL,
    PERSIST_DEBOUNCE_MS,
    assert,
    parsePadRoomName,
    type ClientRoomMessage,
} from '@mmpad/shared'
import { mergeUpdates } from 'yjs'
import { ensurePad } from '../../pad-tree/infrastructure/repository'
import type { WsData } from '../../transport/ws-data'
import {
    appendPadDocRevision,
    createPadDocCheckpoint,
    listPadDocRevisions,
    loadPadDoc,
    readPadDocRevisionText,
} from '../infrastructure/repository'
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
} from './room'

const rooms = new Map<string, PadDocRoom>()

export async function joinPadDocRoom(ws: ServerWebSocket<WsData>) {
    const room = await loadPadDocRoom(ws.data.roomName)
    for (const message of connectPadDocClient(room, ws)) {
        sendRoomMessage(ws, message)
    }
}

export async function leavePadDocRoom(ws: ServerWebSocket<WsData>) {
    const room = rooms.get(ws.data.roomName)
    if (!room) return

    const result = disconnectPadDocClient(room, ws)
    if (result.awarenessMessage) broadcast(room, ws, result.awarenessMessage)
    if (!result.isEmpty) return

    await flushPadDocRoom(room)
    destroyPadDocRoom(room)
    rooms.delete(room.roomName)
}

export function handlePadDocMessage(ws: ServerWebSocket<WsData>, message: ClientRoomMessage) {
    const room = rooms.get(ws.data.roomName)
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
    await Promise.all(Array.from(rooms.values(), (room) => flushPadDocRoom(room)))
}

export function getPadDocRoom(roomName: string) {
    return rooms.get(roomName)
}

async function loadPadDocRoom(roomName: string) {
    const existing = rooms.get(roomName)
    if (existing) return existing

    const parsedRoom = parsePadRoomName(roomName)
    assert(parsedRoom.kind !== 'files', 'File rooms do not persist pad docs')
    await ensurePad(parsedRoom.path)

    const stored = await loadPadDoc(parsedRoom.path, parsedRoom.kind)
    const room = createPadDocRoom({
        roomName,
        path: parsedRoom.path,
        kind: parsedRoom.kind,
        stored,
        onDocumentChanged() {
            scheduleFlush(room)
        },
    })

    rooms.set(roomName, room)
    return room
}

function broadcast(room: PadDocRoom, sender: ServerWebSocket<WsData>, message: { kind: 'sync' | 'awareness'; data: Uint8Array }) {
    for (const client of room.clients) {
        if (client === sender) continue
        sendRoomMessage(client, message)
    }
}

function scheduleFlush(room: PadDocRoom) {
    if (room.flushTimer) clearTimeout(room.flushTimer)
    room.flushTimer = setTimeout(() => {
        room.flushTimer = null
        void flushPadDocRoom(room)
    }, PERSIST_DEBOUNCE_MS)
}

async function flushPadDocRoom(room: PadDocRoom) {
    const updates = takePadDocUpdates(room)
    if (updates.length === 0) return

    const result = await appendPadDocRevision(room.path, room.kind, mergeUpdates(updates), updates.length)
    room.latestChunkSeq = result.chunkSeq
    room.headRevisionId = result.revisionId
    room.headRevisionNumber = result.revisionNumber
    room.docBytes = readPadDocSnapshotBytes(room).byteLength

    if (result.revisionNumber % CHECKPOINT_INTERVAL !== 0) return

    const snapshot = readPadDocSnapshotBytes(room)
    await createPadDocCheckpoint(room.path, room.kind, result.revisionId, result.chunkSeq, snapshot)
    room.docBytes = snapshot.byteLength
}

function sendRoomMessage(ws: ServerWebSocket<WsData>, message: { data: Uint8Array }) {
    ws.sendBinary(Buffer.from(message.data))
}

export { listPadDocRevisions, readPadDocRevisionText }
