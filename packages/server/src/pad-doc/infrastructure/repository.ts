import { Y_TEXT_KEY, type PadDocKind, type PadPath, assert } from '@mmpad/shared'
import { Doc, applyUpdate, mergeUpdates } from 'yjs'
import { sql } from '../../infrastructure/db'

type ChunkRow = {
    seq: number | string
    update: Uint8Array
    event_count?: number
}

type RevisionRow = {
    id: number | string
    revision_number: number | string
    parent_revision_id: number | string | null
    chunk_seq: number | string
    checkpoint_id: number | string | null
    created_at: Date | string
}

type HeadRevisionRow = {
    id: number | string
    revision_number: number | string
    chunk_seq: number | string
}

type CheckpointRow = {
    id: number | string
    chunk_seq: number | string
    snapshot: Uint8Array
}

type RevisionListRow = {
    id: number | string
    revision_number: number | string
    created_at: Date | string
    is_head: boolean
}

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
}

export type PadDocRevisionSummary = {
    id: number
    revisionNumber: number
    createdAt: string
    isHead: boolean
}

export async function loadPadDoc(path: PadPath, kind: PadDocKind): Promise<StoredPadDoc> {
    const head = await loadPadDocHead(path, kind)
    if (!head) {
        return {
            snapshot: null,
            updates: [],
            latestChunkSeq: 0,
            headRevisionId: null,
            headRevisionNumber: 0,
        }
    }

    const checkpoint = await loadNearestCheckpoint(path, kind, toNumber(head.revision_number))
    const rows = await sql<ChunkRow[]>`
        SELECT seq, update
        FROM pad_doc_chunks
        WHERE
            pad_path = ${path}
            AND kind = ${kind}
            AND seq > ${checkpoint ? toNumber(checkpoint.chunk_seq) : 0}
            AND seq <= ${toNumber(head.chunk_seq)}
        ORDER BY seq
    `

    return {
        snapshot: checkpoint ? new Uint8Array(checkpoint.snapshot) : null,
        updates: rows.map((row) => new Uint8Array(row.update)),
        latestChunkSeq: toNumber(head.chunk_seq),
        headRevisionId: toNumber(head.id),
        headRevisionNumber: toNumber(head.revision_number),
    }
}

export async function appendPadDocRevision(
    path: PadPath,
    kind: PadDocKind,
    update: Uint8Array,
    eventCount: number,
): Promise<AppendPadDocRevisionResult> {
    return sql.begin(async (tx: typeof sql) => {
        const [head] = await tx<HeadRevisionRow[]>`
            SELECT r.id, r.revision_number, r.chunk_seq
            FROM pad_doc_heads AS h
            JOIN pad_doc_revisions AS r ON r.id = h.head_revision_id
            WHERE h.pad_path = ${path} AND h.kind = ${kind}
            FOR UPDATE
        `

        const [chunk] = await tx<{ seq: number | string }[]>`
            INSERT INTO pad_doc_chunks (pad_path, kind, update, event_count)
            VALUES (${path}, ${kind}, ${update}, ${eventCount})
            RETURNING seq
        `
        assert(chunk !== undefined, 'Missing chunk seq')

        const previousRevisionNumber = head ? toNumber(head.revision_number) : 0
        const parentRevisionId = head ? toNumber(head.id) : null
        const chunkSeq = toNumber(chunk.seq)

        const [revision] = await tx<{ id: number | string; revision_number: number | string }[]>`
            INSERT INTO pad_doc_revisions (
                pad_path,
                kind,
                revision_number,
                parent_revision_id,
                chunk_seq
            )
            VALUES (
                ${path},
                ${kind},
                ${previousRevisionNumber + 1},
                ${parentRevisionId},
                ${chunkSeq}
            )
            RETURNING id, revision_number
        `
        assert(revision !== undefined, 'Missing revision id')

        const revisionId = toNumber(revision.id)
        const revisionNumber = toNumber(revision.revision_number)

        await tx`
            INSERT INTO pad_doc_heads (pad_path, kind, head_revision_id)
            VALUES (${path}, ${kind}, ${revisionId})
            ON CONFLICT (pad_path, kind) DO UPDATE SET
                head_revision_id = EXCLUDED.head_revision_id,
                updated_at = NOW()
        `

        return {
            chunkSeq,
            revisionId,
            revisionNumber,
        }
    })
}

export async function createPadDocCheckpoint(
    path: PadPath,
    kind: PadDocKind,
    revisionId: number,
    chunkSeq: number,
    snapshot: Uint8Array,
) {
    return sql.begin(async (tx: typeof sql) => {
        const [checkpoint] = await tx<{ id: number | string }[]>`
            INSERT INTO pad_doc_checkpoints (pad_path, kind, revision_id, chunk_seq, snapshot)
            VALUES (${path}, ${kind}, ${revisionId}, ${chunkSeq}, ${snapshot})
            RETURNING id
        `
        assert(checkpoint !== undefined, 'Missing checkpoint id')
        const checkpointId = toNumber(checkpoint.id)

        await tx`
            UPDATE pad_doc_revisions
            SET checkpoint_id = ${checkpointId}
            WHERE id = ${revisionId} AND pad_path = ${path} AND kind = ${kind}
        `

        return checkpointId
    })
}

export async function listPadDocRevisions(path: PadPath, kind: PadDocKind): Promise<PadDocRevisionSummary[]> {
    const rows = await sql<RevisionListRow[]>`
        SELECT
            r.id,
            r.revision_number,
            r.created_at,
            r.id = h.head_revision_id AS is_head
        FROM pad_doc_revisions AS r
        LEFT JOIN pad_doc_heads AS h
            ON h.pad_path = r.pad_path
            AND h.kind = r.kind
        WHERE r.pad_path = ${path} AND r.kind = ${kind}
        ORDER BY r.revision_number DESC
    `

    return rows.map((row) => ({
        id: toNumber(row.id),
        revisionNumber: toNumber(row.revision_number),
        createdAt: toIsoString(row.created_at),
        isHead: row.is_head,
    }))
}

export async function readPadDocRevisionText(path: PadPath, revisionId: number) {
    const revision = await loadRevisionById(path, 'text', revisionId)
    if (!revision) return null

    const bytes = await loadPadDocRevisionBytes(path, 'text', toNumber(revision.id))
    const doc = new Doc()
    if (bytes.byteLength > 0) applyUpdate(doc, bytes)
    const content = doc.getText(Y_TEXT_KEY).toString()
    doc.destroy()

    return {
        id: toNumber(revision.id),
        revisionNumber: toNumber(revision.revision_number),
        createdAt: toIsoString(revision.created_at),
        content,
    }
}

export async function loadPadDocRevisionBytes(path: PadPath, kind: PadDocKind, revisionId: number) {
    const revision = await loadRevisionById(path, kind, revisionId)
    assert(revision !== null, `Missing revision ${revisionId}`)

    const checkpoint = await loadNearestCheckpoint(path, kind, toNumber(revision.revision_number))
    const rows = await sql<ChunkRow[]>`
        SELECT seq, update
        FROM pad_doc_chunks
        WHERE
            pad_path = ${path}
            AND kind = ${kind}
            AND seq > ${checkpoint ? toNumber(checkpoint.chunk_seq) : 0}
            AND seq <= ${toNumber(revision.chunk_seq)}
        ORDER BY seq
    `

    return mergePadDoc(
        checkpoint ? new Uint8Array(checkpoint.snapshot) : null,
        rows.map((row) => new Uint8Array(row.update)),
    )
}

export function mergePadDoc(snapshot: Uint8Array | null, updates: Uint8Array[]) {
    if (!snapshot && updates.length === 0) return new Uint8Array()
    if (!snapshot) return mergeUpdates(updates)
    if (updates.length === 0) return snapshot
    return mergeUpdates([snapshot, ...updates])
}

async function loadPadDocHead(path: PadPath, kind: PadDocKind) {
    const [head] = await sql<HeadRevisionRow[]>`
        SELECT r.id, r.revision_number, r.chunk_seq
        FROM pad_doc_heads AS h
        JOIN pad_doc_revisions AS r ON r.id = h.head_revision_id
        WHERE h.pad_path = ${path} AND h.kind = ${kind}
    `

    return head ?? null
}

async function loadNearestCheckpoint(path: PadPath, kind: PadDocKind, revisionNumber: number) {
    const [checkpoint] = await sql<CheckpointRow[]>`
        SELECT c.id, c.chunk_seq, c.snapshot
        FROM pad_doc_revisions AS r
        JOIN pad_doc_checkpoints AS c ON c.id = r.checkpoint_id
        WHERE
            r.pad_path = ${path}
            AND r.kind = ${kind}
            AND r.revision_number <= ${revisionNumber}
            AND r.checkpoint_id IS NOT NULL
        ORDER BY r.revision_number DESC
        LIMIT 1
    `

    return checkpoint ?? null
}

async function loadRevisionById(path: PadPath, kind: PadDocKind, revisionId: number) {
    const [revision] = await sql<RevisionRow[]>`
        SELECT id, revision_number, parent_revision_id, chunk_seq, checkpoint_id, created_at
        FROM pad_doc_revisions
        WHERE id = ${revisionId} AND pad_path = ${path} AND kind = ${kind}
    `

    return revision ?? null
}

function toIsoString(value: Date | string) {
    return (value instanceof Date ? value : new Date(value)).toISOString()
}

function toNumber(value: number | string) {
    return typeof value === 'number' ? value : Number(value)
}
