import { assert } from '@mpad/core/assert'
import type { PadPath } from '@mpad/core/pad-path'
import type { PadDocKind } from '@mpad/core/pad-room'
import { and, asc, eq, gt, isNotNull, lte } from 'drizzle-orm'
import { db } from '#/db/client'
import { padDocs, padRevisions, pads } from '#/db/schema'
import type { DocRepository, StoredPadDoc } from '#/workspace/doc-model'
export { appendPadDocRevision, createPadDocCheckpoint } from './doc-write'
import { appendPadDocRevision, createPadDocCheckpoint } from './doc-write'
export {
    listPadDocRevisions,
    loadPadDocRevisionBytes,
    mergePadDoc,
} from './doc-history'

type DocHeadRow = {
    docId: number
    headRevisionId: number | null
    headRevisionNumber: number
    checkpointRevisionId: number | null
    checkpointRevisionNumber: number | null
}

export const postgresDocRepository: DocRepository = {
    appendRevision: appendPadDocRevision,
    createCheckpoint: createPadDocCheckpoint,
    loadDoc: loadPadDoc,
}

export async function loadPadDoc(
    path: PadPath,
    kind: PadDocKind,
): Promise<StoredPadDoc> {
    const doc = await loadPadDocHead(path, kind)
    if (!doc) return createEmptyStoredPadDoc()
    if (doc.headRevisionId === null || doc.headRevisionNumber === 0) {
        return createEmptyStoredPadDoc()
    }

    const checkpoint =
        doc.checkpointRevisionId !== null &&
        doc.checkpointRevisionNumber !== null
            ? await loadCheckpointById(doc.docId, doc.checkpointRevisionId)
            : null
    const updates = await loadRevisionUpdates(
        doc.docId,
        checkpoint ? doc.checkpointRevisionNumber! : 0,
        doc.headRevisionNumber,
    )

    return {
        snapshot: checkpoint ? readSnapshotBytes(checkpoint.snapshot) : null,
        updates: updates.map((row) => new Uint8Array(row.update)),
        latestChunkSeq: doc.headRevisionId,
        headRevisionId: doc.headRevisionId,
        headRevisionNumber: doc.headRevisionNumber,
    }
}

function createEmptyStoredPadDoc(): StoredPadDoc {
    return {
        snapshot: null,
        updates: [],
        latestChunkSeq: 0,
        headRevisionId: null,
        headRevisionNumber: 0,
    }
}

async function loadPadDocHead(path: PadPath, kind: PadDocKind) {
    const [row] = await db
        .select({
            docId: padDocs.id,
            headRevisionId: padDocs.headRevisionId,
            headRevisionNumber: padDocs.headRevisionNumber,
            checkpointRevisionId: padDocs.checkpointRevisionId,
            checkpointRevisionNumber: padDocs.checkpointRevisionNumber,
        })
        .from(pads)
        .innerJoin(padDocs, eq(padDocs.padId, pads.id))
        .where(and(eq(pads.path, path), eq(padDocs.kind, kind)))

    return row ?? null
}

async function loadCheckpointById(docId: number, revisionId: number) {
    const [checkpoint] = await db
        .select({
            revisionNumber: padRevisions.revisionNumber,
            snapshot: padRevisions.snapshot,
        })
        .from(padRevisions)
        .where(
            and(
                eq(padRevisions.docId, docId),
                eq(padRevisions.id, revisionId),
                isNotNull(padRevisions.snapshot),
            ),
        )
        .limit(1)

    return checkpoint ?? null
}

async function loadRevisionUpdates(
    docId: number,
    afterRevisionNumber: number,
    throughRevisionNumber: number,
) {
    return db
        .select({ update: padRevisions.update })
        .from(padRevisions)
        .where(
            and(
                eq(padRevisions.docId, docId),
                gt(padRevisions.revisionNumber, afterRevisionNumber),
                lte(padRevisions.revisionNumber, throughRevisionNumber),
            ),
        )
        .orderBy(asc(padRevisions.revisionNumber))
}

function readSnapshotBytes(snapshot: Uint8Array | null) {
    assert(snapshot !== null, 'Expected checkpoint snapshot')
    return new Uint8Array(snapshot)
}
