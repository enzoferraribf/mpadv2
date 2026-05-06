import type {
    DailyActivityRow,
    DashboardStats,
    HourPoint,
    MetricPoint,
} from '@/shared/stats'
import type { SQL } from 'bun'
import type { ParsedRange } from './date-range'

type Sql = SQL

type DocumentCounts = {
    textDocuments: number
    drawingDocuments: number
}

type PadTotals = {
    totalPads: number
    rootPaths: number
    activeRootPaths: number
    rootPathsCreated: number
    existingRootPaths: number
}

type RevisionSummary = {
    latestRevisionAt: string | null
}

type DailyActivitySqlRow = Omit<DailyActivityRow, 'revisionBytes'> & {
    revisionBytes: number | string
}

export async function readDashboardStats(
    sql: Sql,
    range: ParsedRange,
    timezone: string,
): Promise<DashboardStats> {
    const [
        dailyRows,
        editedPadTotal,
        revisionBytes,
        documentCounts,
        padTotals,
        hourlyRows,
        revisionSummary,
    ] = await Promise.all([
        readDailyRows(sql, range, timezone),
        readEditedPadTotal(sql, range),
        readTotalRevisionBytes(sql, range),
        readDocumentCounts(sql),
        readPadTotals(sql, range),
        readHourlyRevisions(sql, range, timezone),
        readRevisionSummary(sql, range),
    ])

    const dailyByDate = new Map(dailyRows.map((row) => [row.date, row]))
    const dailyActivity = range.days.map((date) => {
        const row = dailyByDate.get(date)
        return (
            row ?? {
                date,
                padsCreated: 0,
                padsEdited: 0,
                textRevisions: 0,
                drawingRevisions: 0,
                totalActivity: 0,
                revisionBytes: 0,
            }
        )
    })
    const series = dailyActivity.map(
        ({
            date,
            padsCreated,
            padsEdited,
            textRevisions,
            drawingRevisions,
        }) => ({
            date,
            padsCreated,
            padsEdited,
            textRevisions,
            drawingRevisions,
        }),
    )
    const padsCreated = sum(series, 'padsCreated')
    const textRevisions = sum(series, 'textRevisions')
    const drawingRevisions = sum(series, 'drawingRevisions')
    const totalRevisions = textRevisions + drawingRevisions
    const totalDocuments =
        documentCounts.textDocuments + documentCounts.drawingDocuments

    return {
        range: { from: range.from, to: range.to, timezone },
        generatedAt: new Date().toISOString(),
        totals: {
            padsCreated,
            padsEdited: editedPadTotal,
            textRevisions,
            drawingRevisions,
            textDocuments: documentCounts.textDocuments,
            drawingDocuments: documentCounts.drawingDocuments,
            totalRevisionBytes: revisionBytes,
            totalPads: padTotals.totalPads,
            rootPaths: padTotals.rootPaths,
            activeRootPaths: padTotals.activeRootPaths,
            rootPathsCreated: padTotals.rootPathsCreated,
            existingRootPaths: padTotals.existingRootPaths,
            activeDays: series.filter(hasActivity).length,
            averageRevisionBytes:
                totalRevisions === 0
                    ? 0
                    : Math.round(revisionBytes / totalRevisions),
            creationToEditRate: percent(editedPadTotal, padsCreated),
            averageEditsPerEditedPad: ratio(totalRevisions, editedPadTotal),
            averagePadsPerRoot: ratio(padTotals.totalPads, padTotals.rootPaths),
            textDocumentRatio: percent(
                documentCounts.textDocuments,
                totalDocuments,
            ),
            newRootShare: percent(
                padTotals.rootPathsCreated,
                padTotals.activeRootPaths,
            ),
            latestRevisionAt: revisionSummary.latestRevisionAt,
            fileTransfersTracked: false,
        },
        series,
        dailyActivity,
        hourlyRevisions: fillHourlyRevisions(hourlyRows),
    }
}

async function readDailyRows(
    sql: Sql,
    range: ParsedRange,
    timezone: string,
): Promise<DailyActivityRow[]> {
    const rows = await sql<DailyActivitySqlRow[]>`
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
                COUNT(*) FILTER (WHERE d.kind = 'drawing')::int AS drawing_revisions,
                COALESCE(SUM(octet_length(r.update)), 0)::bigint AS revision_bytes
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
            COALESCE(edited.drawing_revisions, 0)::int AS "drawingRevisions",
            (
                COALESCE(created.pads_created, 0)
                + COALESCE(edited.pads_edited, 0)
                + COALESCE(edited.text_revisions, 0)
                + COALESCE(edited.drawing_revisions, 0)
            )::int AS "totalActivity",
            COALESCE(edited.revision_bytes, 0)::bigint AS "revisionBytes"
        FROM created
        FULL OUTER JOIN edited ON edited.date = created.date
        ORDER BY date
    `
    return rows.map((row) => ({
        ...row,
        revisionBytes: Number(row.revisionBytes),
    }))
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

async function readPadTotals(sql: Sql, range: ParsedRange): Promise<PadTotals> {
    const [row] = await sql<PadTotals[]>`
        WITH root_first AS (
            SELECT root_path, MIN(created_at) AS first_created_at
            FROM pads
            GROUP BY root_path
        ),
        active_roots AS (
            SELECT root_path
            FROM pads
            WHERE created_at >= ${range.startUtc} AND created_at < ${range.endUtc}
            UNION
            SELECT DISTINCT p.root_path
            FROM pad_revisions r
            JOIN pad_docs d ON d.id = r.doc_id
            JOIN pads p ON p.id = d.pad_id
            WHERE r.created_at >= ${range.startUtc} AND r.created_at < ${range.endUtc}
        ),
        new_active_roots AS (
            SELECT active_roots.root_path
            FROM active_roots
            JOIN root_first ON root_first.root_path = active_roots.root_path
            WHERE
                root_first.first_created_at >= ${range.startUtc}
                AND root_first.first_created_at < ${range.endUtc}
        )
        SELECT
            (SELECT COUNT(*) FROM pads)::int AS "totalPads",
            (SELECT COUNT(*) FROM root_first)::int AS "rootPaths",
            (SELECT COUNT(*) FROM active_roots)::int AS "activeRootPaths",
            (SELECT COUNT(*) FROM new_active_roots)::int AS "rootPathsCreated",
            (
                (SELECT COUNT(*) FROM active_roots)
                - (SELECT COUNT(*) FROM new_active_roots)
            )::int AS "existingRootPaths"
    `
    return (
        row ?? {
            totalPads: 0,
            rootPaths: 0,
            activeRootPaths: 0,
            rootPathsCreated: 0,
            existingRootPaths: 0,
        }
    )
}

async function readHourlyRevisions(
    sql: Sql,
    range: ParsedRange,
    timezone: string,
) {
    return sql<HourPoint[]>`
        SELECT
            EXTRACT(HOUR FROM created_at AT TIME ZONE ${timezone})::int AS hour,
            COUNT(*)::int AS revisions
        FROM pad_revisions
        WHERE created_at >= ${range.startUtc} AND created_at < ${range.endUtc}
        GROUP BY 1
        ORDER BY 1
    `
}

async function readRevisionSummary(
    sql: Sql,
    range: ParsedRange,
): Promise<RevisionSummary> {
    const [row] = await sql<RevisionSummary[]>`
        SELECT MAX(created_at)::text AS "latestRevisionAt"
        FROM pad_revisions
        WHERE created_at >= ${range.startUtc} AND created_at < ${range.endUtc}
    `
    return row ?? { latestRevisionAt: null }
}

function fillHourlyRevisions(rows: HourPoint[]) {
    const byHour = new Map(rows.map((row) => [row.hour, row.revisions]))
    return Array.from({ length: 24 }, (_, hour) => ({
        hour,
        revisions: byHour.get(hour) ?? 0,
    }))
}

function sum(series: MetricPoint[], key: keyof Omit<MetricPoint, 'date'>) {
    return series.reduce((total, point) => total + point[key], 0)
}

function hasActivity(point: MetricPoint) {
    return (
        point.padsCreated > 0 ||
        point.padsEdited > 0 ||
        point.textRevisions > 0 ||
        point.drawingRevisions > 0
    )
}

function ratio(value: number, total: number) {
    if (total === 0) return 0
    return Math.round((value / total) * 10) / 10
}

function percent(value: number, total: number) {
    if (total === 0) return 0
    return Math.round((value / total) * 1000) / 10
}
