import { assertNever } from '@mpad/core/assert'
import { readClientRoomMessage } from '@mpad/protocol/room-message-codec'
import type { ServerWebSocket } from 'bun'
import {
    closeLiveFileRoomClient,
    handleLiveFileRoomMessage,
    openLiveFileRoomClient,
} from '#/files/service'
import type { ServerRuntime } from '#/platform/runtime/runtime'
import type { WsData } from '#/platform/ws/data'
import {
    flushPadDocRooms,
    handlePadDocMessage,
    joinPadDocRoom,
    leavePadDocRoom,
} from './doc-service'

export async function openWorkspaceSocket(
    runtime: ServerRuntime,
    socket: ServerWebSocket<WsData>,
) {
    switch (socket.data.roomKind) {
        case 'files':
            await openLiveFileRoomClient(runtime, socket)
            return
        case 'text':
        case 'drawing':
            await joinPadDocRoom(runtime, socket)
            return
    }

    assertNever(socket.data.roomKind)
}

export async function closeWorkspaceSocket(
    runtime: ServerRuntime,
    socket: ServerWebSocket<WsData>,
) {
    switch (socket.data.roomKind) {
        case 'files':
            await closeLiveFileRoomClient(runtime, socket)
            return
        case 'text':
        case 'drawing':
            await leavePadDocRoom(runtime, socket)
            return
    }

    assertNever(socket.data.roomKind)
}

export async function handleWorkspaceSocketMessage(
    runtime: ServerRuntime,
    socket: ServerWebSocket<WsData>,
    data: Uint8Array,
) {
    const message = readClientRoomMessage(data)

    switch (socket.data.roomKind) {
        case 'files':
            handleLiveFileRoomMessage(runtime, socket, message)
            return
        case 'text':
        case 'drawing':
            await handlePadDocMessage(runtime, socket, message)
            return
    }

    assertNever(socket.data.roomKind)
}

export async function flushWorkspaceRooms(runtime: ServerRuntime) {
    await flushPadDocRooms(runtime)
}
