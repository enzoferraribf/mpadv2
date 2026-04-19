import { assertNever } from '@mpad/core/assert'
import { readClientRoomMessage } from '@mpad/protocol/room-message-codec'
import type { ServerWebSocket } from 'bun'
import type { ServerRuntime } from '#/bootstrap/runtime'
import {
    flushPadDocRooms,
    handlePadDocMessage,
    joinPadDocRoom,
    leavePadDocRoom,
} from '#/collab/infrastructure/doc-room-service'
import {
    closeLiveFileRoomClient,
    handleLiveFileRoomMessage,
    openLiveFileRoomClient,
} from '#/live-files/application/live-file-room-service'
import type { WsData } from '#/transport/ws-data'

export async function openWorkspaceSocket(
    runtime: ServerRuntime,
    ws: ServerWebSocket<WsData>,
) {
    switch (ws.data.roomKind) {
        case 'files':
            await openLiveFileRoomClient(runtime, ws)
            return
        case 'text':
        case 'drawing':
            await joinPadDocRoom(runtime, ws)
            return
    }

    assertNever(ws.data.roomKind)
}

export async function closeWorkspaceSocket(
    runtime: ServerRuntime,
    ws: ServerWebSocket<WsData>,
) {
    switch (ws.data.roomKind) {
        case 'files':
            await closeLiveFileRoomClient(runtime, ws)
            return
        case 'text':
        case 'drawing':
            await leavePadDocRoom(runtime, ws)
            return
    }

    assertNever(ws.data.roomKind)
}

export function handleWorkspaceSocketMessage(
    runtime: ServerRuntime,
    ws: ServerWebSocket<WsData>,
    data: Uint8Array,
) {
    const message = readClientRoomMessage(data)

    switch (ws.data.roomKind) {
        case 'files':
            handleLiveFileRoomMessage(runtime, ws, message)
            return
        case 'text':
        case 'drawing':
            handlePadDocMessage(runtime, ws, message)
            return
    }

    assertNever(ws.data.roomKind)
}

export async function flushWorkspaceRooms(runtime: ServerRuntime) {
    await flushPadDocRooms(runtime)
}
