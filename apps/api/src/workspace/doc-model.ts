import type { PadPath } from '@mpad/core/pad-path'
import type { PadDocKind } from '@mpad/core/pad-room'

export type StoredPadDoc = {
    snapshot: Uint8Array | null
    updates: Uint8Array[]
    latestChunkSeq: number
    headRevisionId: number | null
    headRevisionNumber: number
}

export type AppendPadDocRevisionResult = {
    chunkSeq: number
    revisionId: number
    revisionNumber: number
    createdAt: string
}

export type PadDocRevisionSummary = {
    id: number
    revisionNumber: number
    createdAt: string
    isHead: boolean
}

export interface DocRepository {
    appendRevision: (
        path: PadPath,
        kind: PadDocKind,
        update: Uint8Array,
        eventCount: number,
    ) => Promise<AppendPadDocRevisionResult>
    createCheckpoint: (
        path: PadPath,
        kind: PadDocKind,
        revisionId: number,
        chunkSeq: number,
        snapshot: Uint8Array,
    ) => Promise<number>
    loadDoc: (path: PadPath, kind: PadDocKind) => Promise<StoredPadDoc>
}
