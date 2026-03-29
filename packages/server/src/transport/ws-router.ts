import type { ServerWebSocket } from 'bun'
import { readClientRoomMessage } from '@mmpad/shared'
import { handleLiveFileMessage, joinLiveFileRoom, leaveLiveFileRoom } from '../live-file/application/service'
import { flushPadDocRooms, handlePadDocMessage, joinPadDocRoom, leavePadDocRoom } from '../pad-doc/application/service'
import type { WsData } from './ws-data'

export async function openSocket(ws: ServerWebSocket<WsData>) {
    if (ws.data.roomKind === 'files') {
        await joinLiveFileRoom(ws)
        return
    }
    await joinPadDocRoom(ws)
}

export async function closeSocket(ws: ServerWebSocket<WsData>) {
    if (ws.data.roomKind === 'files') {
        await leaveLiveFileRoom(ws)
        return
    }
    await leavePadDocRoom(ws)
}

export function handleSocketMessage(ws: ServerWebSocket<WsData>, data: Uint8Array) {
    const message = readClientRoomMessage(data)

    if (ws.data.roomKind === 'files') {
        handleLiveFileMessage(ws, message)
        return
    }

    handlePadDocMessage(ws, message)
}

export { flushPadDocRooms }
