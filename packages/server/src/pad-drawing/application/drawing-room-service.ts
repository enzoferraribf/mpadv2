import type { ServerWebSocket } from 'bun'
import { assert, type ClientRoomMessage } from '@mmpad/shared'
import type { WsData } from '../../transport/ws-data'
import {
    flushPadDocRooms,
    handlePadDocMessage,
    joinPadDocRoom,
    leavePadDocRoom,
} from '../../collab/infrastructure/doc-room-service'

export async function joinPadDrawingRoom(ws: ServerWebSocket<WsData>) {
    assert(ws.data.roomKind === 'drawing', 'Expected a drawing room')
    await joinPadDocRoom(ws)
}

export async function leavePadDrawingRoom(ws: ServerWebSocket<WsData>) {
    assert(ws.data.roomKind === 'drawing', 'Expected a drawing room')
    await leavePadDocRoom(ws)
}

export function handlePadDrawingMessage(ws: ServerWebSocket<WsData>, message: ClientRoomMessage) {
    assert(ws.data.roomKind === 'drawing', 'Expected a drawing room')
    handlePadDocMessage(ws, message)
}

export async function flushPadDrawingRooms() {
    await flushPadDocRooms()
}
