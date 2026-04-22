import { readFileSync, readdirSync } from 'node:fs'
import { Y_DRAWING_ELEMENTS_KEY, Y_TEXT_KEY } from '@mpad/core/pad-limits'
import type { PadDocKind } from '@mpad/core/pad-room'
import { SQL } from 'bun'
import { Doc, applyUpdate } from 'yjs'
import type { TursoimportLogger } from './log'
import type {
    ConvertedLegacyPad,
    ExistingTargetDocRow,
    ExistingTargetPadRow,
    ImportedPadRow,
    InsertedRevisionRow,
    PadDocPlan,
    RevisionInsertPlan,
    TargetApplyStats,
    TargetDocState,
} from './types'
import {
    buildValuesClause,
    bytesEqual,
    chunk,
    makeDocKey,
    migrationsDirectoryPath,
    toIsoTimestamp,
    toNumber,
} from './utils'

const MIGRATIONS_TABLE = 'schema_migrations'
const PAD_ROW_CHUNK_SIZE = 500
const PAD_DOC_CHUNK_SIZE = 100
const REVISION_WRITE_CHUNK_SIZE = 50
const REVISION_WRITE_BYTE_BUDGET = 8 * 1024 * 1024
const IMPORTER_EVENT_COUNT = 1

export function openTargetDatabase(databaseUrl: string, tls: boolean) {
    return new SQL({
        connectionTimeout: 30,
        tls,
        url: databaseUrl,
    })
}

export async function migrateTargetDatabase(sql: SQL) {
    await ensureMigrationTable(sql)

    const applied = new Set(await loadAppliedMigrations(sql))
    for (const version of listMigrationVersions()) {
        if (applied.has(version)) continue
        const sqlText = readFileSync(
            `${migrationsDirectoryPath}/${version}`,
            'utf8',
        )
        await applySqlMigration(sql, sqlText)
        await sql`
            INSERT INTO schema_migrations (version)
            VALUES (${version})
        `
    }
}

export async function applyLegacyImport(
    sql: SQL,
    pads: ConvertedLegacyPad[],
    padRows: ImportedPadRow[],
    logger: TursoimportLogger,
) {
    const stats: TargetApplyStats = {
        drawingDocsCreated: 0,
        drawingRevisionsAppended: 0,
        padRowsWritten: 0,
        textDocsCreated: 0,
        textRevisionsAppended: 0,
        unchangedDrawingDocs: 0,
        unchangedTextDocs: 0,
    }

    logger.step('sync pad rows start', { total: padRows.length })
    let processedPadRows = 0
    for (const batch of chunk(padRows, PAD_ROW_CHUNK_SIZE)) {
        const written = await sql.begin((tx) => syncPadRowBatch(tx, batch))
        stats.padRowsWritten += written
        processedPadRows += batch.length
        logger.progress('sync pad rows', processedPadRows, padRows.length, {
            padRowsWritten: stats.padRowsWritten,
        })
    }
    logger.step('sync pad rows done', { padRowsWritten: stats.padRowsWritten })

    logger.step('sync pad docs start', { total: pads.length })
    let processedPads = 0
    for (const batch of chunk(pads, PAD_DOC_CHUNK_SIZE)) {
        const batchStats = await sql.begin((tx) => syncPadDocBatch(tx, batch))
        stats.drawingDocsCreated += batchStats.drawingDocsCreated
        stats.drawingRevisionsAppended += batchStats.drawingRevisionsAppended
        stats.textDocsCreated += batchStats.textDocsCreated
        stats.textRevisionsAppended += batchStats.textRevisionsAppended
        stats.unchangedDrawingDocs += batchStats.unchangedDrawingDocs
        stats.unchangedTextDocs += batchStats.unchangedTextDocs
        processedPads += batch.length
        logger.progress('sync pad docs', processedPads, pads.length, {
            drawingDocsCreated: stats.drawingDocsCreated,
            drawingRevisionsAppended: stats.drawingRevisionsAppended,
            textDocsCreated: stats.textDocsCreated,
            textRevisionsAppended: stats.textRevisionsAppended,
        })
    }
    logger.step('sync pad docs done', {
        drawingDocsCreated: stats.drawingDocsCreated,
        drawingRevisionsAppended: stats.drawingRevisionsAppended,
        textDocsCreated: stats.textDocsCreated,
        textRevisionsAppended: stats.textRevisionsAppended,
        unchangedDrawingDocs: stats.unchangedDrawingDocs,
        unchangedTextDocs: stats.unchangedTextDocs,
    })

    return stats
}

async function syncPadRowBatch(sql: SQL, batch: ImportedPadRow[]) {
    if (batch.length === 0) return 0

    const existingRows = await loadExistingPadRows(
        sql,
        batch.map((row) => row.path),
    )
    const rowsToWrite = batch.filter((row) => {
        const current = existingRows.get(row.path)
        if (!current) return true

        return (
            current.parentPath !== row.parentPath ||
            current.createdAt !== row.createdAt ||
            current.updatedAt !== row.updatedAt
        )
    })

    if (rowsToWrite.length === 0) return 0

    await writePadRows(sql, rowsToWrite)
    return rowsToWrite.length
}

async function syncPadDocBatch(sql: SQL, batch: ConvertedLegacyPad[]) {
    if (batch.length === 0) {
        return emptyBatchStats()
    }

    const paths = batch.map((pad) => pad.path)
    const initialDocs = await loadExistingDocRows(sql, paths)
    assertImporterCompatible(initialDocs)

    const docsToCreate = collectDocsToCreate(batch, initialDocs)
    if (docsToCreate.length > 0) {
        await createPadDocs(sql, docsToCreate)
    }

    const docs =
        docsToCreate.length > 0
            ? await loadExistingDocRows(sql, paths)
            : initialDocs
    const plans = buildRevisionPlans(batch, initialDocs, docs)

    if (plans.revisions.length > 0) {
        for (const revisionBatch of chunkRevisionPlans(plans.revisions)) {
            const inserted = await insertPadRevisions(sql, revisionBatch)
            await updatePadDocHeads(sql, revisionBatch, inserted)
        }
    }

    return {
        drawingDocsCreated: docsToCreate.filter((doc) => doc.kind === 'drawing')
            .length,
        drawingRevisionsAppended: plans.revisions.filter(
            (revision) => revision.kind === 'drawing',
        ).length,
        padRowsWritten: 0,
        textDocsCreated: docsToCreate.filter((doc) => doc.kind === 'text')
            .length,
        textRevisionsAppended: plans.revisions.filter(
            (revision) => revision.kind === 'text',
        ).length,
        unchangedDrawingDocs: plans.unchangedDrawingDocs,
        unchangedTextDocs: plans.unchangedTextDocs,
    }
}

async function loadAppliedMigrations(sql: SQL) {
    const rows = await sql<{ version: string }[]>`
        SELECT version
        FROM schema_migrations
        ORDER BY version
    `

    return rows.map((row) => row.version)
}

function listMigrationVersions() {
    return readdirSync(migrationsDirectoryPath)
        .filter((name) => name.endsWith('.sql'))
        .sort()
}

async function ensureMigrationTable(sql: SQL) {
    await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            version    TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
}

async function applySqlMigration(sql: SQL, sqlText: string) {
    const statements = sqlText
        .split(/;\s*\n/g)
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0)

    for (const statement of statements) {
        await sql.unsafe(`${statement};`)
    }
}

async function loadExistingPadRows(sql: SQL, paths: string[]) {
    const rows = await sql<ExistingTargetPadRow[]>`
        SELECT path, parent_path, created_at, updated_at
        FROM pads
        WHERE path = ANY(${sql.array(paths, 'TEXT')})
    `

    return new Map(
        rows.map((row) => [
            row.path,
            {
                createdAt: toIsoTimestamp(row.created_at),
                parentPath: row.parent_path,
                updatedAt: toIsoTimestamp(row.updated_at),
            },
        ]),
    )
}

async function writePadRows(sql: SQL, rows: ImportedPadRow[]) {
    const values = rows.map((row) => [
        row.path,
        row.parentPath,
        row.createdAt,
        row.updatedAt,
    ])
    const { params, sql: valuesSql } = buildValuesClause(values)

    await sql.unsafe(
        `
            INSERT INTO pads (path, parent_path, created_at, updated_at)
            VALUES ${valuesSql}
            ON CONFLICT (path) DO UPDATE
            SET
                parent_path = EXCLUDED.parent_path,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
        `,
        params,
    )
}

async function loadExistingDocRows(sql: SQL, paths: string[]) {
    const rows = await sql<ExistingTargetDocRow[]>`
        SELECT
            d.id AS doc_id,
            d.pad_path,
            d.kind,
            d.head_revision_id,
            r.revision_number AS head_revision_number,
            r.snapshot
        FROM pad_docs AS d
        LEFT JOIN pad_revisions AS r ON r.id = d.head_revision_id
        WHERE d.pad_path = ANY(${sql.array(paths, 'TEXT')})
    `

    return new Map(
        rows.map((row) => [
            makeDocKey(row.pad_path, row.kind),
            {
                docId: toNumber(row.doc_id),
                headRevisionId:
                    row.head_revision_id === null
                        ? null
                        : toNumber(row.head_revision_id),
                headRevisionNumber:
                    row.head_revision_number === null
                        ? null
                        : toNumber(row.head_revision_number),
                kind: row.kind,
                path: row.pad_path,
                snapshot:
                    row.snapshot === null ? null : new Uint8Array(row.snapshot),
            },
        ]),
    )
}

function assertImporterCompatible(docs: Map<string, TargetDocState>) {
    for (const doc of docs.values()) {
        if (doc.headRevisionId === null || doc.headRevisionNumber === null) {
            throw new Error(
                `Target is not importer-compatible for ${doc.path}:${doc.kind}. Existing docs must have a head revision with a snapshot.`,
            )
        }

        if (doc.snapshot === null) {
            throw new Error(
                `Target is not importer-compatible for ${doc.path}:${doc.kind}. Existing head revisions must store snapshot bytes.`,
            )
        }
    }
}

function collectDocsToCreate(
    batch: ConvertedLegacyPad[],
    docs: Map<string, TargetDocState>,
) {
    const plans: PadDocPlan[] = []

    for (const pad of batch) {
        if (pad.hasTextContent && !docs.has(makeDocKey(pad.path, 'text'))) {
            plans.push({
                kind: 'text',
                path: pad.path,
                timestamp: pad.updatedAt,
            })
        }

        if (
            pad.hasDrawingContent &&
            !docs.has(makeDocKey(pad.path, 'drawing'))
        ) {
            plans.push({
                kind: 'drawing',
                path: pad.path,
                timestamp: pad.updatedAt,
            })
        }
    }

    return plans
}

async function createPadDocs(sql: SQL, plans: PadDocPlan[]) {
    const values = plans.map((plan) => [
        plan.path,
        plan.kind,
        plan.timestamp,
        plan.timestamp,
    ])
    const { params, sql: valuesSql } = buildValuesClause(values)

    await sql.unsafe(
        `
            INSERT INTO pad_docs (pad_path, kind, created_at, updated_at)
            VALUES ${valuesSql}
            ON CONFLICT (pad_path, kind) DO NOTHING
        `,
        params,
    )
}

function buildRevisionPlans(
    batch: ConvertedLegacyPad[],
    initialDocs: Map<string, TargetDocState>,
    docs: Map<string, TargetDocState>,
) {
    const revisions: RevisionInsertPlan[] = []
    let unchangedTextDocs = 0
    let unchangedDrawingDocs = 0

    for (const pad of batch) {
        const specs = [
            {
                bytes: pad.textBytes,
                hasContent: pad.hasTextContent,
                kind: 'text' as const,
            },
            {
                bytes: pad.drawingBytes,
                hasContent: pad.hasDrawingContent,
                kind: 'drawing' as const,
            },
        ]

        for (const spec of specs) {
            const key = makeDocKey(pad.path, spec.kind)
            const initial = initialDocs.get(key)
            const current = docs.get(key)

            if (!current) {
                if (!spec.hasContent) continue
                throw new Error(`Missing ${spec.kind} doc for ${pad.path}`)
            }

            if (current.headRevisionId === null) {
                if (initial) {
                    throw new Error(
                        `Target is not importer-compatible for ${pad.path}:${spec.kind}. Existing docs must have a head revision.`,
                    )
                }

                revisions.push({
                    bytes: spec.bytes,
                    docId: current.docId,
                    kind: spec.kind,
                    parentRevisionId: null,
                    revisionNumber: 1,
                    timestamp: pad.updatedAt,
                })
                continue
            }

            if (
                current.snapshot === null ||
                current.headRevisionNumber === null
            ) {
                throw new Error(
                    `Target is not importer-compatible for ${pad.path}:${spec.kind}. Existing head revisions must store snapshot bytes.`,
                )
            }

            if (docSnapshotsEqual(spec.kind, current.snapshot, spec.bytes)) {
                if (spec.kind === 'text') {
                    unchangedTextDocs += 1
                } else {
                    unchangedDrawingDocs += 1
                }
                continue
            }

            revisions.push({
                bytes: spec.bytes,
                docId: current.docId,
                kind: spec.kind,
                parentRevisionId: current.headRevisionId,
                revisionNumber: current.headRevisionNumber + 1,
                timestamp: pad.updatedAt,
            })
        }
    }

    return {
        revisions,
        unchangedDrawingDocs,
        unchangedTextDocs,
    }
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

        return [revision.docId, revisionId, revision.timestamp]
    })
    const { params, sql: valuesSql } = buildValuesClause(values)

    await sql.unsafe(
        `
            UPDATE pad_docs AS d
            SET
                head_revision_id = v.revision_id,
                updated_at = v.updated_at::timestamptz
            FROM (
                VALUES ${valuesSql}
            ) AS v(doc_id, revision_id, updated_at)
            WHERE d.id = v.doc_id
        `,
        params,
    )
}

function emptyBatchStats(): TargetApplyStats {
    return {
        drawingDocsCreated: 0,
        drawingRevisionsAppended: 0,
        padRowsWritten: 0,
        textDocsCreated: 0,
        textRevisionsAppended: 0,
        unchangedDrawingDocs: 0,
        unchangedTextDocs: 0,
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

function docSnapshotsEqual(
    kind: PadDocKind,
    left: Uint8Array,
    right: Uint8Array,
) {
    if (bytesEqual(left, right)) return true

    if (kind === 'text') {
        return readSnapshotText(left) === readSnapshotText(right)
    }

    return (
        readSnapshotDrawingSignature(left) ===
        readSnapshotDrawingSignature(right)
    )
}

function readSnapshotText(bytes: Uint8Array) {
    const doc = new Doc()
    if (bytes.byteLength > 0) applyUpdate(doc, bytes)
    const text = doc.getText(Y_TEXT_KEY).toString()
    doc.destroy()
    return text
}

function readSnapshotDrawingSignature(bytes: Uint8Array) {
    const doc = new Doc()
    if (bytes.byteLength > 0) applyUpdate(doc, bytes)

    const order = doc.getArray<string>('order').toArray()
    const entries = Array.from(
        doc.getMap<unknown>(Y_DRAWING_ELEMENTS_KEY).entries(),
    ).sort(([left], [right]) => left.localeCompare(right))

    doc.destroy()
    return JSON.stringify({ entries, order })
}
