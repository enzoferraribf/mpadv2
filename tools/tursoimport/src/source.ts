import { Database } from 'bun:sqlite'
import { type PadPath, padPath } from '@mpad/core/pad-path'
export { syncLegacyReplica, syncLegacySqlite } from './source-sync'
import type { LegacyPadRow, SourceRow } from './types'

export function readLegacySourceRows(sqlitePath: string) {
    const sqlite = new Database(sqlitePath, { create: false, readonly: true })

    try {
        const rows = sqlite
            .query(`
                SELECT id, content, last_update, last_transaction
                FROM pads
                ORDER BY id ASC
            `)
            .all() as SourceRow[]
        return rows.map(toLegacyPadRow)
    } finally {
        sqlite.close()
    }
}

export function selectLegacyPadRows(rows: LegacyPadRow[]) {
    const grouped = new Map<PadPath, LegacyPadRow[]>()

    for (const row of rows) {
        const normalizedPath = normalizeLegacyPadPath(row.id)
        const group = grouped.get(normalizedPath)
        if (group) {
            group.push(row)
            continue
        }
        grouped.set(normalizedPath, [row])
    }

    const selected = Array.from(grouped.entries(), ([path, group]) => {
        const preferred = [...group].sort(compareLegacyRows)[0]!
        return {
            ...preferred,
            path,
            rawIds: group.map((row) => row.id).sort(),
        }
    }).sort((left, right) => left.path.localeCompare(right.path))

    return {
        duplicatePaths: rows.length - selected.length,
        rows: selected,
    }
}

export function resolveLegacyTimestampMs(row: LegacyPadRow) {
    return Math.max(row.lastUpdate ?? 0, row.lastTransaction ?? 0)
}

function toLegacyPadRow(row: SourceRow): LegacyPadRow {
    return {
        content: row.content,
        id: row.id,
        lastTransaction: row.last_transaction,
        lastUpdate: row.last_update,
    }
}

function normalizeLegacyPadPath(value: string): PadPath {
    return padPath(value)
}

function compareLegacyRows(left: LegacyPadRow, right: LegacyPadRow) {
    const timestampDiff =
        resolveLegacyTimestampMs(right) - resolveLegacyTimestampMs(left)
    if (timestampDiff !== 0) return timestampDiff

    const canonicalDiff =
        Number(isCanonicalLegacyId(right.id)) -
        Number(isCanonicalLegacyId(left.id))
    if (canonicalDiff !== 0) return canonicalDiff

    const contentDiff = right.content.length - left.content.length
    if (contentDiff !== 0) return contentDiff

    return left.id.localeCompare(right.id)
}

function isCanonicalLegacyId(value: string) {
    return value === normalizeLegacyPadPath(value)
}
