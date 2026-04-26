import { assert } from '@mpad/core/assert'
import type { PadPath } from '@mpad/core/pad-path'
import type { PadDocKind } from '@mpad/core/pad-room'
import { and, asc, desc, eq, gt, isNotNull, lte } from 'drizzle-orm'
import { mergeUpdates } from 'yjs'
import { db } from '#/db/client'
import { padDocs, padRevisions, pads } from '#/db/schema'
import type { PadDocRevisionSummary } from '#/workspace/doc-model'

export async function listPadDocRevisions(
    path: PadPath,
    kind: PadDocKind,
): Promise<PadDocRevisionSummary[]> {
    const rows = await db
        .select({
            id: padRevisions.id,
            revisionNumber: padRevisions.revisionNumber,
            createdAt: padRevisions.createdAt,
            headRevisionId: padDocs.headRevisionId,
        })
        .from(pads)
        .innerJoin(padDocs, eq(padDocs.padId, pads.id))
        .innerJoin(padRevisions, eq(padRevisions.docId, padDocs.id))
        .where(and(eq(pads.path, path), eq(padDocs.kind, kind)))
        .orderBy(desc(padRevisions.revisionNumber))

    return rows.map((row) => ({
        id: row.id,
        revisionNumber: row.revisionNumber,
        createdAt: row.createdAt.toISOString(),
        isHead: row.id === row.headRevisionId,
    }))
}

export async function loadPadDocRevisionBytes(
    path: PadPath,
    kind: PadDocKind,
    revisionId: number,
) {
    const revision = await loadRevisionById(path, kind, revisionId)
    assert(revision !== null, `Missing revision ${revisionId}`)

    const checkpoint = await loadNearestCheckpoint(
        revision.docId,
        revision.revisionNumber,
    )
    const updates = await loadRevisionUpdates(
        revision.docId,
        checkpoint ? checkpoint.revisionNumber : 0,
        revision.revisionNumber,
    )

    return mergePadDoc(
        checkpoint ? readSnapshotBytes(checkpoint.snapshot) : null,
        updates.map((row) => new Uint8Array(row.update)),
    )
}

export function mergePadDoc(
    snapshot: Uint8Array | null,
    updates: Uint8Array[],
) {
    if (!snapshot && updates.length === 0) return new Uint8Array()
    if (!snapshot) return mergeUpdates(updates)
    if (updates.length === 0) return snapshot
    return mergeUpdates([snapshot, ...updates])
}

async function loadNearestCheckpoint(docId: number, revisionNumber: number) {
    const [checkpoint] = await db
        .select({
            revisionNumber: padRevisions.revisionNumber,
            snapshot: padRevisions.snapshot,
        })
        .from(padRevisions)
        .where(
            and(
                eq(padRevisions.docId, docId),
                lte(padRevisions.revisionNumber, revisionNumber),
                isNotNull(padRevisions.snapshot),
            ),
        )
        .orderBy(desc(padRevisions.revisionNumber))
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

async function loadRevisionById(
    path: PadPath,
    kind: PadDocKind,
    revisionId: number,
) {
    const [revision] = await db
        .select({
            id: padRevisions.id,
            docId: padRevisions.docId,
            revisionNumber: padRevisions.revisionNumber,
            parentRevisionId: padRevisions.parentRevisionId,
            createdAt: padRevisions.createdAt,
        })
        .from(pads)
        .innerJoin(padDocs, eq(padDocs.padId, pads.id))
        .innerJoin(padRevisions, eq(padRevisions.docId, padDocs.id))
        .where(
            and(
                eq(pads.path, path),
                eq(padDocs.kind, kind),
                eq(padRevisions.id, revisionId),
            ),
        )

    return revision ?? null
}

function readSnapshotBytes(snapshot: Uint8Array | null) {
    assert(snapshot !== null, 'Expected checkpoint snapshot')
    return new Uint8Array(snapshot)
}
