import type { ServerWebSocket } from 'bun'
import { assertNever, readClientRoomMessage } from '@mmpad/shared'
import { flushPadDrawingRooms, handlePadDrawingMessage, joinPadDrawingRoom, leavePadDrawingRoom } from '../../pad-drawing/application/drawing-room-service'
import { flushPadTextRooms, handlePadTextMessage, joinPadTextRoom, leavePadTextRoom } from '../../pad-text/application/text-room-service'
import {
    closeLiveFileRoomClient,
    handleLiveFileRoomMessage,
    openLiveFileRoomClient,
} from '../../live-files/application/live-file-room-service'
import type { WsData } from '../../transport/ws-data'

export async function openWorkspaceSocket(ws: ServerWebSocket<WsData>) {
    switch (ws.data.roomKind) {
        case 'files':
            await openLiveFileRoomClient(ws)
            return
        case 'text':
            await joinPadTextRoom(ws)
            return
        case 'drawing':
            await joinPadDrawingRoom(ws)
            return
    }

    assertNever(ws.data.roomKind)
}

export async function closeWorkspaceSocket(ws: ServerWebSocket<WsData>) {
    switch (ws.data.roomKind) {
        case 'files':
            await closeLiveFileRoomClient(ws)
            return
        case 'text':
            await leavePadTextRoom(ws)
            return
        case 'drawing':
            await leavePadDrawingRoom(ws)
            return
    }

    assertNever(ws.data.roomKind)
}

export function handleWorkspaceSocketMessage(ws: ServerWebSocket<WsData>, data: Uint8Array) {
    const message = readClientRoomMessage(data)

    switch (ws.data.roomKind) {
        case 'files':
            handleLiveFileRoomMessage(ws, message)
            return
        case 'text':
            handlePadTextMessage(ws, message)
            return
        case 'drawing':
            handlePadDrawingMessage(ws, message)
            return
    }

    assertNever(ws.data.roomKind)
}

export async function flushWorkspaceRooms() {
    await flushPadTextRooms()
    await flushPadDrawingRooms()
}
