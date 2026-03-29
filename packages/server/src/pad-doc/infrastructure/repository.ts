import { type PadDocKind, type PadPath, assert } from '@mmpad/shared'
import { mergeUpdates } from 'yjs'
import { sql } from '../../infrastructure/db'

type SnapshotRow = {
    snapshot: Uint8Array
    version: number
}

type ChunkRow = {
    id: number
    update: Uint8Array
}

export type StoredPadDoc = {
    snapshot: Uint8Array | null
    version: number
    updates: Uint8Array[]
    latestUpdateId: number
}

export async function loadPadDoc(path: PadPath, kind: PadDocKind): Promise<StoredPadDoc> {
    const [snapshot] = await sql<SnapshotRow[]>`
        SELECT snapshot, version
        FROM pad_doc_snapshots
        WHERE pad_path = ${path} AND kind = ${kind}
    `

    const rows = await sql<ChunkRow[]>`
        SELECT id, update
        FROM pad_doc_chunks
        WHERE pad_path = ${path} AND kind = ${kind} AND id > ${snapshot?.version ?? 0}
        ORDER BY id
    `

    return {
        snapshot: snapshot ? new Uint8Array(snapshot.snapshot) : null,
        version: snapshot?.version ?? 0,
        updates: rows.map((row) => new Uint8Array(row.update)),
        latestUpdateId: rows.at(-1)?.id ?? snapshot?.version ?? 0,
    }
}

export async function appendPadDocChunk(path: PadPath, kind: PadDocKind, update: Uint8Array, eventCount: number) {
    const [row] = await sql<{ id: number }[]>`
        INSERT INTO pad_doc_chunks (pad_path, kind, update, event_count)
        VALUES (${path}, ${kind}, ${update}, ${eventCount})
        RETURNING id
    `
    assert(row !== undefined, 'Missing chunk id')
    return row.id
}

export async function compactPadDoc(path: PadPath, kind: PadDocKind, snapshot: Uint8Array, version: number) {
    await sql.begin(async (tx: typeof sql) => {
        await tx`
            INSERT INTO pad_doc_snapshots (pad_path, kind, snapshot, version)
            VALUES (${path}, ${kind}, ${snapshot}, ${version})
            ON CONFLICT (pad_path, kind) DO UPDATE SET
                snapshot = EXCLUDED.snapshot,
                version = EXCLUDED.version,
                updated_at = NOW()
        `
        await tx`
            DELETE FROM pad_doc_chunks
            WHERE pad_path = ${path} AND kind = ${kind} AND id <= ${version}
        `
    })
}

export function mergePadDoc(snapshot: Uint8Array | null, updates: Uint8Array[]) {
    if (!snapshot && updates.length === 0) return new Uint8Array()
    if (!snapshot) return mergeUpdates(updates)
    if (updates.length === 0) return snapshot
    return mergeUpdates([snapshot, ...updates])
}
