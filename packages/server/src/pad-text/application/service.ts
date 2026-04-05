import type { ServerWebSocket } from 'bun'
import { assert, type ClientRoomMessage } from '@mmpad/shared'
import type { WsData } from '../../transport/ws-data'
import { listPadTextRevisions, readPadTextRevision, readPadTextRevisionUpdate } from '../infrastructure/repository'
import {
    flushPadDocRooms,
    handlePadDocMessage,
    joinPadDocRoom,
    leavePadDocRoom,
    revertPadDocRoomToUpdate,
} from '../../pad-doc/application/service'

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

export async function revertPadTextRevision(path: import('@mmpad/shared').PadPath, revisionId: number) {
    const revision = await readPadTextRevision(path, revisionId)
    if (!revision) return null

    const update = await readPadTextRevisionUpdate(path, revisionId)
    if (!update) return null

    return revertPadDocRoomToUpdate({
        path,
        kind: 'text',
        revertedFromRevisionId: revisionId,
        revertedFromRevisionNumber: revision.revisionNumber,
        update,
    })
}

export { listPadTextRevisions, readPadTextRevision, readPadTextRevisionUpdate }
