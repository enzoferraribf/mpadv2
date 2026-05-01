import type {
    DashboardStats,
    MetricPoint,
    PadCountRow,
    PadSizeRow,
} from '@/shared/stats'
import type { SQL } from 'bun'
import { readBytea } from './bytea'
import type { ParsedRange } from './date-range'
import { readDrawingElementCount, readTextCharacters } from './doc-read'
import type { StoredRevision } from './doc-read'
import { buildHistogram } from './histogram'

type Sql = SQL

type DocRow = {
    doc_id: number
    path: string
    kind: 'text' | 'drawing'
}

type RevisionRow = {
    doc_id: number
    revision_number: number
    update: unknown
    snapshot: unknown | null
}

export async function readDashboardStats(
    sql: Sql,
    range: ParsedRange,
    timezone: string,
): Promise<DashboardStats> {
    const [dailyRows, topEditedPads, busiestRootPaths, revisionBytes, docs] =
        await Promise.all([
            readDailyRows(sql, range, timezone),
            readTopEditedPads(sql, range),
            readBusiestRootPaths(sql, range),
            readTotalRevisionBytes(sql, range),
            readDocs(sql),
        ])

    const docIds = docs.map((doc) => doc.doc_id)
    const revisions = docIds.length
        ? await readDocRevisions(sql, docIds)
        : new Map<number, StoredRevision[]>()
    const textPads: PadSizeRow[] = []
    const drawingElementCounts: number[] = []
    let unreadableDocuments = 0

    for (const doc of docs) {
        const docRevisions = revisions.get(doc.doc_id) ?? []
        if (doc.kind === 'text') {
            const characters = readMetric(doc, () =>
                readTextCharacters(docRevisions),
            )
            if (characters === null) {
                unreadableDocuments += 1
                continue
            }
            textPads.push({
                path: doc.path,
                characters,
            })
            continue
        }
        const elementCount = readMetric(doc, () =>
            readDrawingElementCount(docRevisions),
        )
        if (elementCount === null) {
            unreadableDocuments += 1
            continue
        }
        drawingElementCounts.push(elementCount)
    }

    const dailyByDate = new Map(dailyRows.map((row) => [row.date, row]))
    const series = range.days.map((date) => ({
        date,
        padsCreated: dailyByDate.get(date)?.padsCreated ?? 0,
        padsEdited: dailyByDate.get(date)?.padsEdited ?? 0,
        textRevisions: dailyByDate.get(date)?.textRevisions ?? 0,
        drawingRevisions: dailyByDate.get(date)?.drawingRevisions ?? 0,
    }))

    return {
        range: { from: range.from, to: range.to, timezone },
        generatedAt: new Date().toISOString(),
        totals: {
            padsCreated: sum(series, 'padsCreated'),
            padsEdited: await readEditedPadTotal(sql, range),
            textRevisions: sum(series, 'textRevisions'),
            drawingRevisions: sum(series, 'drawingRevisions'),
            drawings: drawingElementCounts.filter((count) => count > 0).length,
            drawingElements: drawingElementCounts.reduce(
                (total, count) => total + count,
                0,
            ),
            totalRevisionBytes: revisionBytes,
            fileTransfersTracked: false,
        },
        series,
        textSizeDistribution: buildHistogram(
            textPads.map((pad) => pad.characters),
            [0, 1, 100, 1000, 5000, 20000],
        ),
        drawingElementDistribution: buildHistogram(
            drawingElementCounts,
            [0, 1, 5, 20, 100],
        ),
        topEditedPads,
        largestTextPads: textPads
            .sort((left, right) => right.characters - left.characters)
            .slice(0, 10),
        busiestRootPaths,
        warnings: {
            unreadableDocuments,
        },
    }
}

async function readDailyRows(sql: Sql, range: ParsedRange, timezone: string) {
    return sql<MetricPoint[]>`
        WITH created AS (
            SELECT
                to_char(created_at AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS date,
                COUNT(*)::int AS pads_created
            FROM pads
            WHERE created_at >= ${range.startUtc} AND created_at < ${range.endUtc}
            GROUP BY 1
        ),
        edited AS (
            SELECT
                to_char(r.created_at AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS date,
                COUNT(DISTINCT p.id)::int AS pads_edited,
                COUNT(*) FILTER (WHERE d.kind = 'text')::int AS text_revisions,
                COUNT(*) FILTER (WHERE d.kind = 'drawing')::int AS drawing_revisions
            FROM pad_revisions r
            JOIN pad_docs d ON d.id = r.doc_id
            JOIN pads p ON p.id = d.pad_id
            WHERE r.created_at >= ${range.startUtc} AND r.created_at < ${range.endUtc}
            GROUP BY 1
        )
        SELECT
            COALESCE(created.date, edited.date) AS date,
            COALESCE(created.pads_created, 0)::int AS "padsCreated",
            COALESCE(edited.pads_edited, 0)::int AS "padsEdited",
            COALESCE(edited.text_revisions, 0)::int AS "textRevisions",
            COALESCE(edited.drawing_revisions, 0)::int AS "drawingRevisions"
        FROM created
        FULL OUTER JOIN edited ON edited.date = created.date
        ORDER BY date
    `
}

async function readEditedPadTotal(sql: Sql, range: ParsedRange) {
    const [row] = await sql<{ count: number }[]>`
        SELECT COUNT(DISTINCT p.id)::int AS count
        FROM pad_revisions r
        JOIN pad_docs d ON d.id = r.doc_id
        JOIN pads p ON p.id = d.pad_id
        WHERE r.created_at >= ${range.startUtc} AND r.created_at < ${range.endUtc}
    `
    return row?.count ?? 0
}

async function readTopEditedPads(sql: Sql, range: ParsedRange) {
    return sql<PadCountRow[]>`
        SELECT p.path, COUNT(*)::int AS count
        FROM pad_revisions r
        JOIN pad_docs d ON d.id = r.doc_id
        JOIN pads p ON p.id = d.pad_id
        WHERE r.created_at >= ${range.startUtc} AND r.created_at < ${range.endUtc}
        GROUP BY p.path
        ORDER BY count DESC, p.path ASC
        LIMIT 10
    `
}

async function readBusiestRootPaths(sql: Sql, range: ParsedRange) {
    return sql<PadCountRow[]>`
        SELECT p.root_path AS path, COUNT(*)::int AS count
        FROM pad_revisions r
        JOIN pad_docs d ON d.id = r.doc_id
        JOIN pads p ON p.id = d.pad_id
        WHERE r.created_at >= ${range.startUtc} AND r.created_at < ${range.endUtc}
        GROUP BY p.root_path
        ORDER BY count DESC, p.root_path ASC
        LIMIT 10
    `
}

async function readTotalRevisionBytes(sql: Sql, range: ParsedRange) {
    const [row] = await sql<{ bytes: number | string }[]>`
        SELECT COALESCE(SUM(octet_length(update)), 0)::bigint AS bytes
        FROM pad_revisions
        WHERE created_at >= ${range.startUtc} AND created_at < ${range.endUtc}
    `
    return Number(row?.bytes ?? 0)
}

async function readDocs(sql: Sql) {
    return sql<DocRow[]>`
        SELECT d.id AS doc_id, p.path, d.kind
        FROM pad_docs d
        JOIN pads p ON p.id = d.pad_id
        WHERE d.head_revision_id IS NOT NULL
        ORDER BY p.path ASC, d.kind ASC
    `
}

async function readDocRevisions(sql: Sql, docIds: number[]) {
    const rows = await sql<RevisionRow[]>`
        SELECT doc_id, revision_number, update, snapshot
        FROM pad_revisions
        WHERE doc_id IN ${sql(docIds)}
        ORDER BY doc_id ASC, revision_number ASC
    `
    const byDoc = new Map<number, StoredRevision[]>()
    for (const row of rows) {
        const revisions = byDoc.get(row.doc_id) ?? []
        try {
            revisions.push({
                revisionNumber: row.revision_number,
                update: readBytea(row.update),
                snapshot: row.snapshot ? readBytea(row.snapshot) : null,
            })
        } catch (error) {
            console.warn('Skipping unreadable revision bytes', {
                docId: row.doc_id,
                revisionNumber: row.revision_number,
                error,
            })
        }
        byDoc.set(row.doc_id, revisions)
    }
    return byDoc
}

function readMetric(doc: DocRow, read: () => number) {
    try {
        return read()
    } catch (error) {
        console.warn('Skipping unreadable document', {
            docId: doc.doc_id,
            kind: doc.kind,
            path: doc.path,
            error,
        })
        return null
    }
}

function sum(series: MetricPoint[], key: keyof Omit<MetricPoint, 'date'>) {
    return series.reduce((total, point) => total + point[key], 0)
}
