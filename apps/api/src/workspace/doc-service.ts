import { WS_POLICY_CLOSE_CODE } from '@mpad/core/pad-limits'
import type { PadPath } from '@mpad/core/pad-path'
import { type PadDocKind, parsePadRoomName } from '@mpad/core/pad-room'
import {
    type ClientRoomMessage,
    createAwarenessMessage,
} from '@mpad/protocol/room-message-codec'
import type { ServerWebSocket } from 'bun'
import type { ServerRuntime } from '#/platform/runtime/runtime'
import type { WsData } from '#/platform/ws/data'
import { sendSocketBytes } from '#/platform/ws/send'
import { flushPadDocRoom, schedulePadDocFlush } from './doc-flush'
import {
    type PadDocRoom,
    applyPadDocAwareness,
    applyPadDocSync,
    connectPadDocClient,
    createPadDocRoom,
    destroyPadDocRoom,
    disconnectPadDocClient,
} from './doc-room'

export async function joinPadDocRoom(
    runtime: ServerRuntime,
    socket: ServerWebSocket<WsData>,
) {
    const room = await loadPadDocRoom(runtime, socket.data.roomName)
    for (const message of connectPadDocClient(room, socket)) {
        sendRoomMessage(socket, message)
    }
}

export async function leavePadDocRoom(
    runtime: ServerRuntime,
    socket: ServerWebSocket<WsData>,
) {
    const room = runtime.docRoomRegistry.get(socket.data.roomName)
    if (!room) return

    const result = disconnectPadDocClient(room, socket)
    if (result.awarenessMessage)
        broadcast(room, socket, result.awarenessMessage)
    if (!result.isEmpty) return

    await flushPadDocRoom(runtime, room)
    destroyPadDocRoom(room)
    runtime.docRoomRegistry.delete(room.roomName)
}

export async function handlePadDocMessage(
    runtime: ServerRuntime,
    socket: ServerWebSocket<WsData>,
    message: ClientRoomMessage,
) {
    if (message.kind === 'heartbeat') return
    if (
        message.kind === 'sync' &&
        !(await runtime.rateLimiter.canWritePad(socket.data.roomName))
    ) {
        socket.close(WS_POLICY_CLOSE_CODE, 'Write rate limit exceeded')
        return
    }

    const room = await loadPadDocRoom(runtime, socket.data.roomName)

    switch (message.kind) {
        case 'sync': {
            const result = applyPadDocSync(room, message.data)
            if (result.reply) sendRoomMessage(socket, result.reply)
            broadcast(room, socket, result.broadcast)
            return
        }
        case 'awareness':
            broadcast(
                room,
                socket,
                applyPadDocAwareness(room, socket, message.data),
            )
            return
    }
}

export async function flushPadDocRooms(runtime: ServerRuntime) {
    await Promise.all(
        Array.from(runtime.docRoomRegistry.values(), (room) =>
            flushPadDocRoom(runtime, room),
        ),
    )
}

export function getPadDocRoom(runtime: ServerRuntime, roomName: string) {
    return runtime.docRoomRegistry.get(roomName)
}

async function loadPadDocRoom(runtime: ServerRuntime, roomName: string) {
    const existing = runtime.docRoomRegistry.get(roomName)
    if (existing) return existing

    const parsedRoom = parsePadRoomName(roomName)
    await runtime.ensurePadExists(parsedRoom.path)

    const stored = await runtime.docRepository.loadDoc(
        parsedRoom.path,
        parsedRoom.kind,
    )
    const loaded = runtime.docRoomRegistry.get(roomName)
    if (loaded) return loaded

    const room = createPadDocRoom({
        roomName,
        path: parsedRoom.path,
        kind: parsedRoom.kind,
        stored,
        onDocumentChanged() {
            schedulePadDocFlush(runtime, room)
        },
    })
    watchPadDocAwarenessTimeouts(room)

    runtime.docRoomRegistry.set(roomName, room)
    return room
}

function broadcast(
    room: PadDocRoom,
    sender: ServerWebSocket<WsData>,
    message: { kind: 'sync' | 'awareness'; data: Uint8Array },
) {
    for (const client of room.clients) {
        if (client === sender) continue
        sendRoomMessage(client, message)
    }
}

function broadcastAll(
    room: PadDocRoom,
    message: { kind: 'awareness'; data: Uint8Array },
) {
    for (const client of room.clients) sendRoomMessage(client, message)
}

function watchPadDocAwarenessTimeouts(room: PadDocRoom) {
    room.awareness.on(
        'update',
        (
            change: {
                added: number[]
                updated: number[]
                removed: number[]
            },
            origin: unknown,
        ) => {
            if (origin !== 'timeout') return
            const clientIds = [
                ...change.added,
                ...change.updated,
                ...change.removed,
            ]
            if (clientIds.length === 0) return
            broadcastAll(
                room,
                createAwarenessMessage(room.awareness, clientIds),
            )
        },
    )
}

function sendRoomMessage(
    socket: ServerWebSocket<WsData>,
    message: { data: Uint8Array },
) {
    sendSocketBytes(socket, message.data)
}
