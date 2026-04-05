import type { ServerWebSocket } from 'bun'
import { assert, type ClientRoomMessage } from '@mmpad/shared'
import type { WsData } from '../../transport/ws-data'
import {
    flushPadDocRooms,
    handlePadDocMessage,
    joinPadDocRoom,
    leavePadDocRoom,
} from '../../collab/infrastructure/doc-room-service'

export async function joinPadTextRoom(ws: ServerWebSocket<WsData>) {
    assert(ws.data.roomKind === 'text', 'Expected a text room')
    await joinPadDocRoom(ws)
}

export async function leavePadTextRoom(ws: ServerWebSocket<WsData>) {
    assert(ws.data.roomKind === 'text', 'Expected a text room')
    await leavePadDocRoom(ws)
}

export function handlePadTextMessage(ws: ServerWebSocket<WsData>, message: ClientRoomMessage) {
    assert(ws.data.roomKind === 'text', 'Expected a text room')
    handlePadDocMessage(ws, message)
}

export async function flushPadTextRooms() {
    await flushPadDocRooms()
}
