import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate as migrateWithDrizzle } from 'drizzle-orm/bun-sql/migrator'
import type { TursoimportLogger } from './log'
import { PAD_ROW_CHUNK_SIZE, syncPadRowBatch } from './target-pad-rows'
import { writeRevisionBatches } from './target-revisions'
import { docSnapshotsEqual } from './target-snapshot'
import type {
    ConvertedLegacyPad,
    ExistingTargetDocRow,
    ImportedPadRow,
    PadDocPlan,
    RevisionInsertPlan,
    TargetApplyStats,
    TargetDocState,
} from './types'
import {
    buildValuesClause,
    chunk,
    makeDocKey,
    migrationsDirectoryPath,
    toNumber,
} from './utils'

const PAD_DOC_CHUNK_SIZE = 100

export function openTargetDatabase(databaseUrl: string, tls: boolean) {
    return new SQL({
        connectionTimeout: 30,
        tls,
        url: databaseUrl,
    })
}

export async function migrateTargetDatabase(sql: SQL) {
    await migrateWithDrizzle(drizzle({ client: sql }), {
        migrationsFolder: migrationsDirectoryPath,
    })
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
        const written = await sql.begin((transaction) =>
            syncPadRowBatch(transaction, batch),
        )
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
        const batchStats = await sql.begin((transaction) =>
            syncPadDocBatch(transaction, batch),
        )
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
        await writeRevisionBatches(sql, plans.revisions)
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

async function loadExistingDocRows(sql: SQL, paths: string[]) {
    const rows = await sql<ExistingTargetDocRow[]>`
        SELECT
            d.id AS doc_id,
            p.path,
            d.kind,
            d.head_revision_id,
            d.head_revision_number,
            r.snapshot
        FROM pad_docs AS d
        JOIN pads AS p ON p.id = d.pad_id
        LEFT JOIN pad_revisions AS r ON r.id = d.head_revision_id
        WHERE p.path = ANY(${sql.array(paths, 'TEXT')})
    `

    return new Map(
        rows.map((row) => [
            makeDocKey(row.path, row.kind),
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
                path: row.path,
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
            INSERT INTO pad_docs (pad_id, kind, created_at, updated_at)
            SELECT p.id, v.kind, v.created_at::timestamptz, v.updated_at::timestamptz
            FROM (
                VALUES ${valuesSql}
            ) AS v(path, kind, created_at, updated_at)
            JOIN pads AS p ON p.path = v.path
            ON CONFLICT (pad_id, kind) DO NOTHING
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
