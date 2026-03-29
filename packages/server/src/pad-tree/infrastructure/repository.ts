import type { PadPath, PadTreeItem } from '@mmpad/shared'
import { padPathName, parentPadPath, rootPadPath } from '@mmpad/shared'
import { sql } from '../../infrastructure/db'

type PadRow = {
    path: string
    parent_path: string | null
}

export async function ensurePad(path: PadPath) {
    await sql`
        INSERT INTO pads (path, parent_path)
        VALUES (${path}, ${parentPadPath(path)})
        ON CONFLICT (path) DO UPDATE SET
            parent_path = EXCLUDED.parent_path,
            updated_at = NOW()
    `
}

export async function listRelatedPads(path: PadPath): Promise<PadTreeItem[]> {
    const rootPath = rootPadPath(path)
    const rows = await sql<PadRow[]>`
        SELECT DISTINCT path, parent_path
        FROM pads
        WHERE
            path = ${rootPath}
            OR path LIKE ${rootPath + '/%'}
        ORDER BY path ASC
    `

    const items = new Map<PadPath, PadTreeItem>()
    items.set(rootPath, {
        path: rootPath,
        parentPath: parentPadPath(rootPath),
        name: padPathName(rootPath),
    })
    items.set(path, {
        path,
        parentPath: parentPadPath(path),
        name: padPathName(path),
    })

    for (const row of rows) {
        const itemPath = row.path as PadPath
        items.set(itemPath, {
            path: itemPath,
            parentPath: row.parent_path as PadPath | null,
            name: padPathName(itemPath),
        })
    }

    return Array.from(items.values()).sort(comparePadTreeItems)
}

function comparePadTreeItems(left: PadTreeItem, right: PadTreeItem) {
    if (left.path < right.path) return -1
    if (left.path > right.path) return 1
    return 0
}
