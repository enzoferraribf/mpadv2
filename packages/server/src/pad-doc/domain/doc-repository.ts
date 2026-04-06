import type { PadDocKind } from '@mpad/core/pad-room'
import type { PadPath } from '@mpad/core/pad-path'

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
    revertedFromRevisionNumber: number | null
}

export interface DocRepository {
    appendRevision: (
        path: PadPath,
        kind: PadDocKind,
        update: Uint8Array,
        eventCount: number,
        revertedFromRevisionId?: number | null,
    ) => Promise<AppendPadDocRevisionResult>
    createCheckpoint: (
        path: PadPath,
        kind: PadDocKind,
        revisionId: number,
        chunkSeq: number,
        snapshot: Uint8Array,
    ) => Promise<number>
    listRevisions: (path: PadPath, kind: PadDocKind) => Promise<PadDocRevisionSummary[]>
    loadDoc: (path: PadPath, kind: PadDocKind) => Promise<StoredPadDoc>
    loadRevisionBytes: (path: PadPath, kind: PadDocKind, revisionId: number) => Promise<Uint8Array>
    readRevisionText: (path: PadPath, revisionId: number) => Promise<{
        id: number
        revisionNumber: number
        createdAt: string
        content: string
    } | null>
}
