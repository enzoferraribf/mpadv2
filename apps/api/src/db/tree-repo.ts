import { MAX_RELATED_PADS } from '@mpad/core/pad-limits'
import {
    type PadPath,
    padPathName,
    parentPadPath,
    rootPadPath,
} from '@mpad/core/pad-path'
import type { PadTreeItem } from '@mpad/protocol/pad-tree'
import { asc, eq } from 'drizzle-orm'
import { db } from '#/db/client'
import { pads } from '#/db/schema'

export async function ensurePad(path: PadPath) {
    await db
        .insert(pads)
        .values({
            path,
            rootPath: rootPadPath(path),
            parentPath: parentPadPath(path),
        })
        .onConflictDoUpdate({
            target: pads.path,
            set: {
                rootPath: rootPadPath(path),
                parentPath: parentPadPath(path),
                updatedAt: new Date(),
            },
        })
}

export async function listRelatedPads(
    path: PadPath,
    limit = MAX_RELATED_PADS,
): Promise<PadTreeItem[]> {
    const rootPath = rootPadPath(path)
    const rows = await db
        .select({
            path: pads.path,
            parentPath: pads.parentPath,
        })
        .from(pads)
        .where(eq(pads.rootPath, rootPath))
        .orderBy(asc(pads.path))
        .limit(limit)

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
            parentPath: row.parentPath as PadPath | null,
            name: padPathName(itemPath),
        })
    }

    return Array.from(items.values()).sort(comparePadTreeItems).slice(0, limit)
}

function comparePadTreeItems(left: PadTreeItem, right: PadTreeItem) {
    if (left.path < right.path) return -1
    if (left.path > right.path) return 1
    return 0
}
