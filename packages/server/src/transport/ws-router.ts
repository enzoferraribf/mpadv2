import type { ServerWebSocket } from 'bun'
import { assertNever, readClientRoomMessage } from '@mmpad/shared'
import { closeLiveFilesClient, openLiveFilesClient, applyLiveFilesClientMessage } from '../live-files/application/service'
import { flushPadDrawingRooms, handlePadDrawingMessage, joinPadDrawingRoom, leavePadDrawingRoom } from '../pad-drawing/application/service'
import { flushPadTextRooms, handlePadTextMessage, joinPadTextRoom, leavePadTextRoom } from '../pad-text/application/service'
import type { WsData } from './ws-data'

export async function openSocket(ws: ServerWebSocket<WsData>) {
    switch (ws.data.roomKind) {
        case 'files':
            await openLiveFilesClient(ws)
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

export async function closeSocket(ws: ServerWebSocket<WsData>) {
    switch (ws.data.roomKind) {
        case 'files':
            await closeLiveFilesClient(ws)
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

export function handleSocketMessage(ws: ServerWebSocket<WsData>, data: Uint8Array) {
    const message = readClientRoomMessage(data)

    switch (ws.data.roomKind) {
        case 'files':
            applyLiveFilesClientMessage(ws, message)
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

export async function flushPadRooms() {
    await flushPadTextRooms()
    await flushPadDrawingRooms()
}
