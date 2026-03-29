import type { ServerWebSocket } from 'bun'
import {
    COMPACTION_THRESHOLD,
    MAX_DRAWING_BYTES,
    MAX_TEXT_BYTES,
    PERSIST_DEBOUNCE_MS,
    applyAwarenessMessage,
    assertNever,
    createAwarenessMessage,
    createDocUpdateMessage,
    parsePadRoomName,
    replyToSyncMessage,
    type ClientRoomMessage,
    type PadDocKind,
    type PadPath,
} from '@mmpad/shared'
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Doc, applyUpdate, encodeStateAsUpdate, mergeUpdates } from 'yjs'
import { ensurePad } from '../pad-tree/repository'
import { assert } from '../shared/assert'
import type { WsData } from '../transport/ws-data'
import { appendPadDocChunk, compactPadDoc, loadPadDoc, mergePadDoc } from './repository'

export type PadDocRoom = {
    roomName: string
    path: PadPath
    kind: PadDocKind
    doc: Doc
    awareness: Awareness
    clients: Set<ServerWebSocket<WsData>>
    pendingUpdates: Uint8Array[]
    latestChunkId: number
    storedChunkCount: number
    flushTimer: ReturnType<typeof setTimeout> | null
    docBytes: number
}

const rooms = new Map<string, PadDocRoom>()
const DOC_SIZE_PROBE_MARGIN_BYTES = 64 * 1024

export async function joinPadDocRoom(ws: ServerWebSocket<WsData>) {
    const room = await loadPadDocRoom(ws.data.roomName)
    room.clients.add(ws)
    sendRoomMessage(ws, createDocUpdateMessage(encodeStateAsUpdate(room.doc)))

    const clientIds = Array.from(room.awareness.getStates().keys())
    if (clientIds.length > 0) sendRoomMessage(ws, createAwarenessMessage(room.awareness, clientIds))
}

export async function leavePadDocRoom(ws: ServerWebSocket<WsData>) {
    const room = rooms.get(ws.data.roomName)
    if (!room) return

    room.clients.delete(ws)
    awarenessProtocol.removeAwarenessStates(room.awareness, [ws.data.awarenessClientId], null)
    if (room.awareness.meta.has(ws.data.awarenessClientId)) {
        broadcast(room, ws, createAwarenessMessage(room.awareness, [ws.data.awarenessClientId]))
    }

    if (room.clients.size > 0) return

    await flushPadDocRoom(room)
    if (room.flushTimer) clearTimeout(room.flushTimer)
    room.awareness.destroy()
    room.doc.destroy()
    rooms.delete(room.roomName)
}

export function handlePadDocMessage(ws: ServerWebSocket<WsData>, message: ClientRoomMessage) {
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
    const { path, kind } = parsedRoom
    await ensurePad(path)

    const stored = await loadPadDoc(path, kind)
    const doc = new Doc()

    if (stored.snapshot) applyUpdate(doc, stored.snapshot)
    for (const update of stored.updates) applyUpdate(doc, update)

    const room: PadDocRoom = {
        roomName,
        path,
        kind,
        doc,
        awareness: new Awareness(doc),
        clients: new Set(),
        pendingUpdates: [],
        latestChunkId: stored.latestUpdateId,
        storedChunkCount: stored.updates.length,
        flushTimer: null,
        docBytes: encodeStateAsUpdate(doc).byteLength,
    }

    doc.on('update', (update: Uint8Array) => {
        room.pendingUpdates.push(update)
        scheduleFlush(room)
    })

    rooms.set(roomName, room)
    if (room.storedChunkCount >= COMPACTION_THRESHOLD) {
        const snapshot = mergePadDoc(stored.snapshot, stored.updates)
        void compactPadDoc(path, kind, snapshot, stored.latestUpdateId)
    }
    return room
}

function handleSyncMessage(room: PadDocRoom, sender: ServerWebSocket<WsData>, data: Uint8Array) {
    const docBytes = nextDocBytes(room, data)
    assertDocWithinLimit(room, docBytes)
    room.docBytes = docBytes
    const reply = replyToSyncMessage(room.doc, data, null)
    if (reply) sendRoomMessage(sender, reply)
    broadcast(room, sender, { kind: 'sync', data })
}

function handleAwarenessMessage(room: PadDocRoom, sender: ServerWebSocket<WsData>, data: Uint8Array) {
    applyAwarenessMessage(room.awareness, data, sender)
    broadcast(room, sender, { kind: 'awareness', data })
}

function broadcast(
    room: PadDocRoom,
    sender: ServerWebSocket<WsData>,
    message: Extract<ClientRoomMessage, { kind: 'sync' | 'awareness' }>,
) {
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
    const updates = room.pendingUpdates
    room.pendingUpdates = []
    if (updates.length === 0) return

    const mergedUpdate = mergeUpdates(updates)
    room.latestChunkId = await appendPadDocChunk(room.path, room.kind, mergedUpdate, updates.length)
    room.storedChunkCount += 1
    room.docBytes = encodeStateAsUpdate(room.doc).byteLength

    if (room.storedChunkCount >= COMPACTION_THRESHOLD) {
        const snapshot = encodeStateAsUpdate(room.doc)
        await compactPadDoc(room.path, room.kind, snapshot, room.latestChunkId)
        room.storedChunkCount = 0
        room.docBytes = snapshot.byteLength
    }
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

function sendRoomMessage(
    ws: ServerWebSocket<WsData>,
    message: Extract<ClientRoomMessage, { kind: 'sync' | 'awareness' }>,
) {
    ws.sendBinary(Buffer.from(message.data))
}
