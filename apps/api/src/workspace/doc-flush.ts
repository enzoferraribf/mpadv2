import { CHECKPOINT_INTERVAL, PERSIST_DEBOUNCE_MS } from '@mpad/core/pad-limits'
import { mergeUpdates } from 'yjs'
import type { ServerRuntime } from '#/platform/runtime/runtime'
import {
    type PadDocRoom,
    readPadDocSnapshotBytes,
    takePadDocUpdates,
} from './doc-room'

export function schedulePadDocFlush(runtime: ServerRuntime, room: PadDocRoom) {
    if (room.flushTimer) clearTimeout(room.flushTimer)
    room.flushTimer = setTimeout(() => {
        room.flushTimer = null
        void flushPadDocRoom(runtime, room)
    }, PERSIST_DEBOUNCE_MS)
}

export async function flushPadDocRoom(
    runtime: ServerRuntime,
    room: PadDocRoom,
) {
    const updates = takePadDocUpdates(room)
    if (updates.length === 0) return null

    const result = await runtime.docRepository.appendRevision(
        room.path,
        room.kind,
        mergeUpdates(updates),
        updates.length,
    )
    room.latestChunkSeq = result.chunkSeq
    room.headRevisionId = result.revisionId
    room.headRevisionNumber = result.revisionNumber
    room.docBytes = readPadDocSnapshotBytes(room).byteLength

    if (result.revisionNumber % CHECKPOINT_INTERVAL !== 0) return result

    const snapshot = readPadDocSnapshotBytes(room)
    await runtime.docRepository.createCheckpoint(
        room.path,
        room.kind,
        result.revisionId,
        result.chunkSeq,
        snapshot,
    )
    room.docBytes = snapshot.byteLength
    return result
}
