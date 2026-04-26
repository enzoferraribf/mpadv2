import type { SQL } from 'bun'
import type { InsertedRevisionRow, RevisionInsertPlan } from './types'
import { buildValuesClause, toNumber } from './utils'

const REVISION_WRITE_CHUNK_SIZE = 50
const REVISION_WRITE_BYTE_BUDGET = 8 * 1024 * 1024
const IMPORTER_EVENT_COUNT = 1

export async function writeRevisionBatches(
    sql: SQL,
    revisions: RevisionInsertPlan[],
) {
    for (const revisionBatch of chunkRevisionPlans(revisions)) {
        const inserted = await insertPadRevisions(sql, revisionBatch)
        await updatePadDocHeads(sql, revisionBatch, inserted)
    }
}

function chunkRevisionPlans(revisions: RevisionInsertPlan[]) {
    const batches: RevisionInsertPlan[][] = []
    let currentBatch: RevisionInsertPlan[] = []
    let currentBytes = 0

    for (const revision of revisions) {
        const nextBytes = currentBytes + revision.bytes.byteLength
        const shouldFlush =
            currentBatch.length > 0 &&
            (currentBatch.length >= REVISION_WRITE_CHUNK_SIZE ||
                nextBytes > REVISION_WRITE_BYTE_BUDGET)

        if (shouldFlush) {
            batches.push(currentBatch)
            currentBatch = []
            currentBytes = 0
        }

        currentBatch.push(revision)
        currentBytes += revision.bytes.byteLength
    }

    if (currentBatch.length > 0) {
        batches.push(currentBatch)
    }

    return batches
}

async function insertPadRevisions(sql: SQL, revisions: RevisionInsertPlan[]) {
    const values = revisions.map((revision) => [
        revision.docId,
        revision.revisionNumber,
        revision.parentRevisionId,
        null,
        new Uint8Array(),
        revision.bytes,
        IMPORTER_EVENT_COUNT,
        revision.timestamp,
    ])
    const { params, sql: valuesSql } = buildValuesClause(values)

    return sql.unsafe<InsertedRevisionRow[]>(
        `
            INSERT INTO pad_revisions (
                doc_id,
                revision_number,
                parent_revision_id,
                reverted_from_revision_id,
                update,
                snapshot,
                event_count,
                created_at
            )
            VALUES ${valuesSql}
            RETURNING id, doc_id, revision_number
        `,
        params,
    )
}

async function updatePadDocHeads(
    sql: SQL,
    revisions: RevisionInsertPlan[],
    insertedRows: InsertedRevisionRow[],
) {
    const idsByDocRevision = new Map(
        insertedRows.map((row) => [
            `${toNumber(row.doc_id)}:${toNumber(row.revision_number)}`,
            toNumber(row.id),
        ]),
    )

    const values = revisions.map((revision) => {
        const revisionId = idsByDocRevision.get(
            `${revision.docId}:${revision.revisionNumber}`,
        )
        if (revisionId === undefined) {
            throw new Error(
                `Missing inserted revision for doc ${revision.docId} revision ${revision.revisionNumber}`,
            )
        }

        return [
            revision.docId,
            revisionId,
            revision.revisionNumber,
            revision.timestamp,
        ]
    })
    const { params, sql: valuesSql } = buildValuesClause(values)

    await sql.unsafe(
        `
            UPDATE pad_docs AS d
            SET
                head_revision_id = v.revision_id,
                head_revision_number = v.revision_number,
                checkpoint_revision_id = v.revision_id,
                checkpoint_revision_number = v.revision_number,
                updated_at = v.updated_at::timestamptz
            FROM (
                VALUES ${valuesSql}
            ) AS v(doc_id, revision_id, revision_number, updated_at)
            WHERE d.id = v.doc_id
        `,
        params,
    )
}
