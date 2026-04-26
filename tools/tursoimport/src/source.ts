import { Database } from 'bun:sqlite'
import { assert } from '@mpad/core/assert'
import {
    MAX_PAD_PATH_BYTES,
    MAX_PAD_PATH_SEGMENTS,
    MAX_PAD_PATH_SEGMENT_BYTES,
} from '@mpad/core/pad-limits'
import type { PadPath } from '@mpad/core/pad-path'
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
    const normalized = '/' + value.split('/').filter(Boolean).join('/')
    assert(normalized !== '/', 'Pad path is required')
    assert(
        utf8Bytes(normalized) <= MAX_PAD_PATH_BYTES,
        `Pad path exceeds ${MAX_PAD_PATH_BYTES} bytes`,
    )
    assert(!hasControlCharacter(normalized), 'Pad path contains control chars')

    const segments = normalized.split('/').filter(Boolean)
    assert(
        segments.length <= MAX_PAD_PATH_SEGMENTS,
        `Pad path exceeds ${MAX_PAD_PATH_SEGMENTS} segments`,
    )
    for (const segment of segments) {
        assert(segment.trim() === segment, 'Pad path segment has outer spaces')
        assert(
            segment !== '.' && segment !== '..',
            'Pad path segment is unsafe',
        )
        assert(
            utf8Bytes(segment) <= MAX_PAD_PATH_SEGMENT_BYTES,
            `Pad path segment exceeds ${MAX_PAD_PATH_SEGMENT_BYTES} bytes`,
        )
    }

    return normalized as PadPath
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

function hasControlCharacter(value: string) {
    for (const character of value) {
        const code = character.charCodeAt(0)
        if (code < 32 || code === 127) return true
    }
    return false
}

function utf8Bytes(value: string) {
    return new TextEncoder().encode(value).byteLength
}
