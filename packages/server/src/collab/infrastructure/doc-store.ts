import { assert } from '@mpad/core/assert'
import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import type { PadPath } from '@mpad/core/pad-path'
import type { PadDocKind } from '@mpad/core/pad-room'
import { Doc, applyUpdate, mergeUpdates } from 'yjs'
import { sql } from '#/infrastructure/db'
import type {
    AppendPadDocRevisionResult,
    PadDocRevisionSummary,
    StoredPadDoc,
} from '#/pad-doc/domain/doc-repository'

type DocHeadRow = {
    doc_id: number | string
    head_revision_id: number | string | null
    head_revision_number: number | string | null
}

type RevisionRow = {
    id: number | string
    doc_id: number | string
    revision_number: number | string
    parent_revision_id: number | string | null
    reverted_from_revision_id: number | string | null
    created_at: Date | string
}

type RevisionInsertRow = {
    id: number | string
    revision_number: number | string
    created_at: Date | string
}

type SnapshotRow = {
    revision_number: number | string
    snapshot: Uint8Array
}

type RevisionUpdateRow = {
    update: Uint8Array
}

type RevisionListRow = {
    id: number | string
    revision_number: number | string
    created_at: Date | string
    is_head: boolean
    reverted_from_revision_number: number | string | null
}

export async function loadPadDoc(
    path: PadPath,
    kind: PadDocKind,
): Promise<StoredPadDoc> {
    const doc = await loadPadDocHead(path, kind)
    if (!doc) return createEmptyStoredPadDoc()
    if (doc.head_revision_id === null || doc.head_revision_number === null) {
        return createEmptyStoredPadDoc()
    }

    const docId = toNumber(doc.doc_id)
    const headRevisionId = toNumber(doc.head_revision_id)
    const headRevisionNumber = toNumber(doc.head_revision_number)
    const checkpoint = await loadNearestCheckpoint(docId, headRevisionNumber)
    const updates = await loadRevisionUpdates(
        toNumber(doc.doc_id),
        checkpoint ? toNumber(checkpoint.revision_number) : 0,
        headRevisionNumber,
    )

    return {
        snapshot: checkpoint ? new Uint8Array(checkpoint.snapshot) : null,
        updates: updates.map((row) => new Uint8Array(row.update)),
        latestChunkSeq: headRevisionId,
        headRevisionId,
        headRevisionNumber,
    }
}

export async function appendPadDocRevision(
    path: PadPath,
    kind: PadDocKind,
    update: Uint8Array,
    eventCount: number,
    revertedFromRevisionId: number | null = null,
): Promise<AppendPadDocRevisionResult> {
    return sql.begin(async (tx: typeof sql) => {
        await ensurePadDoc(tx, path, kind)

        const doc = await lockPadDocHead(tx, path, kind)
        const revision = await insertPadRevision(tx, {
            docId: toNumber(doc.doc_id),
            parentRevisionId:
                doc.head_revision_id === null
                    ? null
                    : toNumber(doc.head_revision_id),
            previousRevisionNumber:
                doc.head_revision_number === null
                    ? 0
                    : toNumber(doc.head_revision_number),
            revertedFromRevisionId,
            update,
            eventCount,
        })

        await updatePadDocHead(tx, toNumber(doc.doc_id), toNumber(revision.id))

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
    const [row] = await sql<{ doc_id: number | string }[]>`
        SELECT d.id AS doc_id
        FROM pad_docs AS d
        JOIN pad_revisions AS r ON r.doc_id = d.id
        WHERE d.pad_path = ${path} AND d.kind = ${kind} AND r.id = ${revisionId}
    `
    assert(row !== undefined, 'Missing pad doc for checkpoint')

    await sql`
        UPDATE pad_revisions
        SET snapshot = ${snapshot}
        WHERE id = ${revisionId} AND doc_id = ${toNumber(row.doc_id)}
    `

    return revisionId
}

export async function listPadDocRevisions(
    path: PadPath,
    kind: PadDocKind,
): Promise<PadDocRevisionSummary[]> {
    const rows = await sql<RevisionListRow[]>`
        SELECT
            r.id,
            r.revision_number,
            r.created_at,
            r.id = d.head_revision_id AS is_head,
            rr.revision_number AS reverted_from_revision_number
        FROM pad_docs AS d
        JOIN pad_revisions AS r ON r.doc_id = d.id
        LEFT JOIN pad_revisions AS rr ON rr.id = r.reverted_from_revision_id
        WHERE d.pad_path = ${path} AND d.kind = ${kind}
        ORDER BY r.revision_number DESC
    `

    return rows.map((row) => ({
        id: toNumber(row.id),
        revisionNumber: toNumber(row.revision_number),
        createdAt: toIsoString(row.created_at),
        isHead: row.is_head,
        revertedFromRevisionNumber:
            row.reverted_from_revision_number === null
                ? null
                : toNumber(row.reverted_from_revision_number),
    }))
}

export async function readPadDocRevisionText(
    path: PadPath,
    revisionId: number,
) {
    const revision = await loadRevisionById(path, 'text', revisionId)
    if (!revision) return null

    const bytes = await loadPadDocRevisionBytes(
        path,
        'text',
        toNumber(revision.id),
    )
    const content = readTextFromRevisionBytes(bytes)

    return {
        id: toNumber(revision.id),
        revisionNumber: toNumber(revision.revision_number),
        createdAt: toIsoString(revision.created_at),
        content,
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

function readTextFromRevisionBytes(bytes: Uint8Array) {
    const doc = new Doc()
    if (bytes.byteLength > 0) applyUpdate(doc, bytes)
    const content = doc.getText(Y_TEXT_KEY).toString()
    doc.destroy()
    return content
}

export async function loadPadDocRevisionBytes(
    path: PadPath,
    kind: PadDocKind,
    revisionId: number,
) {
    const revision = await loadRevisionById(path, kind, revisionId)
    assert(revision !== null, `Missing revision ${revisionId}`)

    const docId = toNumber(revision.doc_id)
    const revisionNumber = toNumber(revision.revision_number)
    const checkpoint = await loadNearestCheckpoint(docId, revisionNumber)
    const updates = await loadRevisionUpdates(
        docId,
        checkpoint ? toNumber(checkpoint.revision_number) : 0,
        revisionNumber,
    )

    return mergePadDoc(
        checkpoint ? new Uint8Array(checkpoint.snapshot) : null,
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

async function loadPadDocHead(path: PadPath, kind: PadDocKind) {
    const [doc] = await sql<DocHeadRow[]>`
        SELECT
            d.id AS doc_id,
            d.head_revision_id,
            r.revision_number AS head_revision_number
        FROM pad_docs AS d
        LEFT JOIN pad_revisions AS r ON r.id = d.head_revision_id
        WHERE d.pad_path = ${path} AND d.kind = ${kind}
    `

    return doc ?? null
}

async function loadNearestCheckpoint(docId: number, revisionNumber: number) {
    const [checkpoint] = await sql<SnapshotRow[]>`
        SELECT revision_number, snapshot
        FROM pad_revisions
        WHERE
            doc_id = ${docId}
            AND revision_number <= ${revisionNumber}
            AND snapshot IS NOT NULL
        ORDER BY revision_number DESC
        LIMIT 1
    `

    return checkpoint ?? null
}

async function loadRevisionUpdates(
    docId: number,
    afterRevisionNumber: number,
    upToRevisionNumber: number,
) {
    return sql<RevisionUpdateRow[]>`
        SELECT update
        FROM pad_revisions
        WHERE
            doc_id = ${docId}
            AND revision_number > ${afterRevisionNumber}
            AND revision_number <= ${upToRevisionNumber}
        ORDER BY revision_number
    `
}

async function loadRevisionById(
    path: PadPath,
    kind: PadDocKind,
    revisionId: number,
) {
    const [revision] = await sql<RevisionRow[]>`
        SELECT
            r.id,
            r.doc_id,
            r.revision_number,
            r.parent_revision_id,
            r.reverted_from_revision_id,
            r.created_at
        FROM pad_docs AS d
        JOIN pad_revisions AS r ON r.doc_id = d.id
        WHERE r.id = ${revisionId} AND d.pad_path = ${path} AND d.kind = ${kind}
    `

    return revision ?? null
}

function toIsoString(value: Date | string) {
    return (value instanceof Date ? value : new Date(value)).toISOString()
}

async function ensurePadDoc(
    client: typeof sql,
    path: PadPath,
    kind: PadDocKind,
) {
    await client`
        INSERT INTO pad_docs (pad_path, kind)
        VALUES (${path}, ${kind})
        ON CONFLICT (pad_path, kind) DO NOTHING
    `
}

async function lockPadDocHead(
    client: typeof sql,
    path: PadPath,
    kind: PadDocKind,
) {
    const [doc] = await client<DocHeadRow[]>`
        SELECT
            d.id AS doc_id,
            d.head_revision_id,
            r.revision_number AS head_revision_number
        FROM pad_docs AS d
        LEFT JOIN pad_revisions AS r ON r.id = d.head_revision_id
        WHERE d.pad_path = ${path} AND d.kind = ${kind}
        FOR UPDATE OF d
    `
    assert(doc !== undefined, 'Missing pad doc')
    return doc
}

async function insertPadRevision(
    client: typeof sql,
    input: {
        docId: number
        eventCount: number
        parentRevisionId: number | null
        previousRevisionNumber: number
        revertedFromRevisionId: number | null
        update: Uint8Array
    },
) {
    const [revision] = await client<RevisionInsertRow[]>`
        INSERT INTO pad_revisions (
            doc_id,
            revision_number,
            parent_revision_id,
            reverted_from_revision_id,
            update,
            event_count
        )
        VALUES (
            ${input.docId},
            ${input.previousRevisionNumber + 1},
            ${input.parentRevisionId},
            ${input.revertedFromRevisionId},
            ${input.update},
            ${input.eventCount}
        )
        RETURNING id, revision_number, created_at
    `
    assert(revision !== undefined, 'Missing revision id')
    return revision
}

async function updatePadDocHead(
    client: typeof sql,
    docId: number,
    revisionId: number,
) {
    await client`
        UPDATE pad_docs
        SET
            head_revision_id = ${revisionId},
            updated_at = NOW()
        WHERE id = ${docId}
    `
}

function readAppendPadDocRevisionResult(
    revision: RevisionInsertRow,
): AppendPadDocRevisionResult {
    const revisionId = toNumber(revision.id)
    const revisionNumber = toNumber(revision.revision_number)

    return {
        chunkSeq: revisionId,
        revisionId,
        revisionNumber,
        createdAt: toIsoString(revision.created_at),
    }
}

function toNumber(value: number | string) {
    return typeof value === 'number' ? value : Number(value)
}
