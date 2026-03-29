import { beforeAll, describe, expect, test } from 'bun:test'
import { Y_TEXT_KEY, padPath } from '@mmpad/shared'
import { Doc, applyUpdate, encodeStateAsUpdate, mergeUpdates } from 'yjs'
import { ensurePad, listRelatedPads } from '../src/pad-tree/repository'
import { appendPadDocChunk, compactPadDoc, loadPadDoc } from '../src/pad-doc/repository'
import { migrate, sql } from '../src/shared/db'

beforeAll(async () => {
    await migrate()
})

describe('pad doc repository', () => {
    test('stores one merged chunk per flush', async () => {
        const root = uniqueRoot('chunks')
        const path = padPath(`${root}/doc`)
        await cleanupRoot(root)
        await ensurePad(path)

        const doc = new Doc()
        const updates: Uint8Array[] = []
        doc.on('update', (update) => updates.push(update))

        const text = doc.getText(Y_TEXT_KEY)
        text.insert(0, 'hello')
        text.insert(5, ' world')

        const chunkId = await appendPadDocChunk(path, 'text', mergeUpdates(updates), updates.length)
        const stored = await loadPadDoc(path, 'text')

        expect(stored.updates).toHaveLength(1)

        const restored = new Doc()
        applyUpdate(restored, stored.updates[0]!)
        expect(restored.getText(Y_TEXT_KEY).toString()).toBe('hello world')

        const [chunk] = await sql<{ event_count: number }[]>`
            SELECT event_count
            FROM pad_doc_chunks
            WHERE id = ${chunkId}
        `

        expect(chunk?.event_count).toBe(2)
        await cleanupRoot(root)
    })

    test('compacts stored chunks into the snapshot', async () => {
        const root = uniqueRoot('compact')
        const path = padPath(`${root}/doc`)
        await cleanupRoot(root)
        await ensurePad(path)

        const doc = new Doc()
        const updates: Uint8Array[] = []
        doc.on('update', (update) => updates.push(update))

        doc.getText(Y_TEXT_KEY).insert(0, 'hello world')

        const chunkId = await appendPadDocChunk(path, 'text', mergeUpdates(updates), updates.length)
        const snapshot = encodeStateAsUpdate(doc)

        await compactPadDoc(path, 'text', snapshot, chunkId)

        const stored = await loadPadDoc(path, 'text')
        expect(stored.snapshot).not.toBeNull()
        expect(stored.updates).toHaveLength(0)

        const restored = new Doc()
        applyUpdate(restored, stored.snapshot!)
        expect(restored.getText(Y_TEXT_KEY).toString()).toBe('hello world')

        await cleanupRoot(root)
    })
})

describe('pad tree repository', () => {
    test('lists every known pad under the same root for deep paths', async () => {
        const root = uniqueRoot('tree-root')
        const current = padPath(`${root}/branch/start`)
        const alpha = padPath(`${root}/alpha`)
        const nestedAlpha = padPath(`${root}/team/alpha`)
        const zeta = padPath(`${root}/zeta`)
        const outside = padPath(`${uniqueRoot('tree-outside')}/skip`)
        await cleanupRoot(root)

        await ensurePad(alpha)
        await ensurePad(nestedAlpha)
        await ensurePad(zeta)
        await ensurePad(outside)

        const tree = await listRelatedPads(current)

        expect(tree.map((item) => item.path)).toEqual(sortPaths([
            padPath(root),
            current,
            alpha,
            nestedAlpha,
            zeta,
        ]))

        const [row] = await sql<{ count: number }[]>`
            SELECT COUNT(*)::int AS count
            FROM pads
            WHERE path = ${current}
        `

        expect(row?.count).toBe(0)
        await cleanupRoot(root)
        await cleanupRoot(outside.slice(1).split('/')[0]!)
    })

    test('injects only the root and current pad when rows are missing', async () => {
        const root = uniqueRoot('tree-missing')
        const current = padPath(`${root}/one/two`)
        const known = padPath(`${root}/other`)
        const missingAncestor = padPath(`${root}/one`)
        await cleanupRoot(root)

        await ensurePad(known)

        const tree = await listRelatedPads(current)

        expect(tree.map((item) => item.path)).toEqual(sortPaths([
            padPath(root),
            current,
            known,
        ]))
        expect(tree.some((item) => item.path === missingAncestor)).toBe(false)

        await cleanupRoot(root)
    })
})

function uniqueRoot(name: string) {
    return `test-${name}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
}

async function cleanupRoot(root: string) {
    const path = `/${root}`
    await sql`
        DELETE FROM pads
        WHERE path = ${path} OR path LIKE ${path + '/%'}
    `
}

function sortPaths(paths: ReturnType<typeof padPath>[]) {
    return [...paths].sort((left, right) => {
        if (left < right) return -1
        if (left > right) return 1
        return 0
    })
}
