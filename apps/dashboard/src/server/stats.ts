import type { DashboardStats, MetricPoint, PadCountRow } from '@/shared/stats'
import type { SQL } from 'bun'
import type { ParsedRange } from './date-range'

type Sql = SQL

type DocumentCounts = {
    textDocuments: number
    drawingDocuments: number
}

export async function readDashboardStats(
    sql: Sql,
    range: ParsedRange,
    timezone: string,
): Promise<DashboardStats> {
    const [
        dailyRows,
        topEditedPads,
        busiestRootPaths,
        revisionBytes,
        documentCounts,
    ] = await Promise.all([
        readDailyRows(sql, range, timezone),
        readTopEditedPads(sql, range),
        readBusiestRootPaths(sql, range),
        readTotalRevisionBytes(sql, range),
        readDocumentCounts(sql),
    ])

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
            textDocuments: documentCounts.textDocuments,
            drawingDocuments: documentCounts.drawingDocuments,
            totalRevisionBytes: revisionBytes,
            fileTransfersTracked: false,
        },
        series,
        topEditedPads,
        busiestRootPaths,
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

async function readDocumentCounts(sql: Sql): Promise<DocumentCounts> {
    const [row] = await sql<DocumentCounts[]>`
        SELECT
            COUNT(*) FILTER (WHERE kind = 'text')::int AS "textDocuments",
            COUNT(*) FILTER (WHERE kind = 'drawing')::int AS "drawingDocuments"
        FROM pad_docs
        WHERE head_revision_id IS NOT NULL
    `
    return row ?? { textDocuments: 0, drawingDocuments: 0 }
}

function sum(series: MetricPoint[], key: keyof Omit<MetricPoint, 'date'>) {
    return series.reduce((total, point) => total + point[key], 0)
}
