import type { SQL } from 'bun'
import type { ExistingTargetPadRow, ImportedPadRow } from './types'
import { buildValuesClause, toIsoTimestamp } from './utils'

const PAD_ROW_CHUNK_SIZE = 500

export { PAD_ROW_CHUNK_SIZE }

export async function syncPadRowBatch(sql: SQL, batch: ImportedPadRow[]) {
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
            current.rootPath !== row.rootPath ||
            current.createdAt !== row.createdAt ||
            current.updatedAt !== row.updatedAt
        )
    })

    if (rowsToWrite.length === 0) return 0

    await writePadRows(sql, rowsToWrite)
    return rowsToWrite.length
}

async function loadExistingPadRows(sql: SQL, paths: string[]) {
    const rows = await sql<ExistingTargetPadRow[]>`
        SELECT path, root_path, parent_path, created_at, updated_at
        FROM pads
        WHERE path = ANY(${sql.array(paths, 'TEXT')})
    `

    return new Map(
        rows.map((row) => [
            row.path,
            {
                createdAt: toIsoTimestamp(row.created_at),
                parentPath: row.parent_path,
                rootPath: row.root_path,
                updatedAt: toIsoTimestamp(row.updated_at),
            },
        ]),
    )
}

async function writePadRows(sql: SQL, rows: ImportedPadRow[]) {
    const values = rows.map((row) => [
        row.path,
        row.rootPath,
        row.parentPath,
        row.createdAt,
        row.updatedAt,
    ])
    const { params, sql: valuesSql } = buildValuesClause(values)

    await sql.unsafe(
        `
            INSERT INTO pads (path, root_path, parent_path, created_at, updated_at)
            VALUES ${valuesSql}
            ON CONFLICT (path) DO UPDATE
            SET
                root_path = EXCLUDED.root_path,
                parent_path = EXCLUDED.parent_path,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
        `,
        params,
    )
}
