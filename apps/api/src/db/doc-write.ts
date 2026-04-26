import { assert } from '@mpad/core/assert'
import type { PadPath } from '@mpad/core/pad-path'
import type { PadDocKind } from '@mpad/core/pad-room'
import { and, eq } from 'drizzle-orm'
import { db } from '#/db/client'
import { padDocs, padRevisions, pads } from '#/db/schema'
import type { AppendPadDocRevisionResult } from '#/workspace/doc-model'

type Db = typeof db
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]

type DocHeadRow = {
    docId: number
    headRevisionId: number | null
    headRevisionNumber: number
}

type RevisionInsertRow = {
    id: number
    revisionNumber: number
    createdAt: Date
}

export async function appendPadDocRevision(
    path: PadPath,
    kind: PadDocKind,
    update: Uint8Array,
    eventCount: number,
): Promise<AppendPadDocRevisionResult> {
    return db.transaction(async (transaction) => {
        await ensurePadDoc(transaction, path, kind)

        const doc = await lockPadDocHead(transaction, path, kind)
        const revision = await insertPadRevision(transaction, {
            docId: doc.docId,
            parentRevisionId: doc.headRevisionId,
            previousRevisionNumber: doc.headRevisionNumber,
            update,
            eventCount,
        })

        await updatePadDocHead(
            transaction,
            doc.docId,
            revision.id,
            revision.revisionNumber,
        )

        return readAppendPadDocRevisionResult(revision)
    })
}

export async function createPadDocCheckpoint(
    path: PadPath,
    kind: PadDocKind,
    revisionId: number,
    _chunkSeq: number,
    snapshot: Uint8Array,
) {
    const [row] = await db
        .select({
            docId: padDocs.id,
            revisionNumber: padRevisions.revisionNumber,
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

    assert(row !== undefined, 'Missing pad doc for checkpoint')

    await db.transaction(async (transaction) => {
        await transaction
            .update(padRevisions)
            .set({ snapshot })
            .where(
                and(
                    eq(padRevisions.id, revisionId),
                    eq(padRevisions.docId, row.docId),
                ),
            )

        await transaction
            .update(padDocs)
            .set({
                checkpointRevisionId: revisionId,
                checkpointRevisionNumber: row.revisionNumber,
                updatedAt: new Date(),
            })
            .where(eq(padDocs.id, row.docId))
    })

    return revisionId
}

async function ensurePadDoc(
    transaction: Transaction,
    path: PadPath,
    kind: PadDocKind,
) {
    const [pad] = await transaction
        .select({ id: pads.id })
        .from(pads)
        .where(eq(pads.path, path))

    assert(pad !== undefined, `Missing pad for ${path}`)

    await transaction
        .insert(padDocs)
        .values({ padId: pad.id, kind })
        .onConflictDoNothing({
            target: [padDocs.padId, padDocs.kind],
        })
}

async function lockPadDocHead(
    transaction: Transaction,
    path: PadPath,
    kind: PadDocKind,
): Promise<DocHeadRow> {
    const [doc] = await transaction
        .select({
            docId: padDocs.id,
            headRevisionId: padDocs.headRevisionId,
            headRevisionNumber: padDocs.headRevisionNumber,
        })
        .from(pads)
        .innerJoin(padDocs, eq(padDocs.padId, pads.id))
        .where(and(eq(pads.path, path), eq(padDocs.kind, kind)))
        .for('update', { of: padDocs })

    assert(doc !== undefined, `Missing pad doc for ${path} (${kind})`)
    return doc
}

async function insertPadRevision(
    transaction: Transaction,
    input: {
        docId: number
        parentRevisionId: number | null
        previousRevisionNumber: number
        update: Uint8Array
        eventCount: number
    },
) {
    const [row] = await transaction
        .insert(padRevisions)
        .values({
            docId: input.docId,
            parentRevisionId: input.parentRevisionId,
            revisionNumber: input.previousRevisionNumber + 1,
            update: input.update,
            eventCount: input.eventCount,
        })
        .returning({
            id: padRevisions.id,
            revisionNumber: padRevisions.revisionNumber,
            createdAt: padRevisions.createdAt,
        })

    assert(row !== undefined, 'Expected pad revision row')
    return row
}

async function updatePadDocHead(
    transaction: Transaction,
    docId: number,
    revisionId: number,
    revisionNumber: number,
) {
    await transaction
        .update(padDocs)
        .set({
            headRevisionId: revisionId,
            headRevisionNumber: revisionNumber,
            updatedAt: new Date(),
        })
        .where(eq(padDocs.id, docId))
}

function readAppendPadDocRevisionResult(
    row: RevisionInsertRow,
): AppendPadDocRevisionResult {
    return {
        revisionId: row.id,
        revisionNumber: row.revisionNumber,
        createdAt: row.createdAt.toISOString(),
        chunkSeq: row.id,
    }
}
