import { beforeAll, describe, expect, test } from 'bun:test'
import { CHECKPOINT_INTERVAL, Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { padPath } from '@mpad/core/pad-path'
import { Doc, applyUpdate, encodeStateAsUpdate, mergeUpdates } from 'yjs'
import {
    appendPadDocRevision,
    createPadDocCheckpoint,
    listPadDocRevisions,
    loadPadDoc,
    loadPadDocRevisionBytes,
} from '#/collab/infrastructure/doc-store'
import { sql } from '#/infrastructure/db'
import { migrate } from '#/infrastructure/migration-runner'
import {
    ensurePad,
    listRelatedPads,
} from '#/pad-tree/infrastructure/repository'

beforeAll(async () => {
    await migrate()
})

describe('pad doc repository', () => {
    test('stores one merged chunk and one saved revision per flush', async () => {
        const root = uniqueRoot('revisions')
        const path = padPath(`${root}/doc`)
        await cleanupRoot(root)
        await ensurePad(path)

        const doc = new Doc()
        const updates: Uint8Array[] = []
        doc.on('update', (update) => updates.push(update))

        const text = doc.getText(Y_TEXT_KEY)
        text.insert(0, 'hello')
        text.insert(5, ' world')

        const revision = await appendPadDocRevision(
            path,
            'text',
            mergeUpdates(updates),
            updates.length,
        )
        const stored = await loadPadDoc(path, 'text')
        const history = await listPadDocRevisions(path, 'text')

        expect(stored.headRevisionNumber).toBe(1)
        expect(stored.headRevisionId).toBe(revision.revisionId)
        expect(stored.updates).toHaveLength(1)
        expect(history).toEqual([
            expect.objectContaining({
                id: revision.revisionId,
                revisionNumber: 1,
                isHead: true,
            }),
        ])

        const restored = new Doc()
        applyUpdate(restored, stored.updates[0]!)
        expect(restored.getText(Y_TEXT_KEY).toString()).toBe('hello world')

        const [storedRevision] = await sql<{ event_count: number }[]>`
            SELECT event_count
            FROM pad_revisions
            WHERE id = ${revision.revisionId}
        `

        expect(storedRevision?.event_count).toBe(2)
        doc.destroy()
        restored.destroy()
        await cleanupRoot(root)
    })

    test('creates stable per-pad revision numbers and keeps old history after a checkpoint', async () => {
        const root = uniqueRoot('checkpoint')
        const path = padPath(`${root}/doc`)
        await cleanupRoot(root)
        await ensurePad(path)

        const doc = new Doc()
        const updates: Uint8Array[] = []
        doc.on('update', (update) => updates.push(update))

        let firstRevisionId = 0
        let latestRevisionId = 0

        for (let index = 1; index <= CHECKPOINT_INTERVAL + 2; index += 1) {
            doc.getText(Y_TEXT_KEY).insert(
                doc.getText(Y_TEXT_KEY).length,
                `${index}\n`,
            )
            const revision = await appendPadDocRevision(
                path,
                'text',
                mergeUpdates(updates),
                updates.length,
            )
            updates.length = 0

            if (revision.revisionNumber % CHECKPOINT_INTERVAL === 0) {
                await createPadDocCheckpoint(
                    path,
                    'text',
                    revision.revisionId,
                    revision.chunkSeq,
                    encodeStateAsUpdate(doc),
                )
            }

            if (index === 1) firstRevisionId = revision.revisionId
            latestRevisionId = revision.revisionId
        }

        const history = await listPadDocRevisions(path, 'text')
        const stored = await loadPadDoc(path, 'text')
        const [checkpointCount] = await sql<{ count: number }[]>`
            SELECT COUNT(*)::int AS count
            FROM pad_docs AS d
            JOIN pad_revisions AS r ON r.doc_id = d.id
            WHERE d.pad_path = ${path} AND d.kind = 'text' AND r.snapshot IS NOT NULL
        `
        const [revisionCount] = await sql<{ count: number }[]>`
            SELECT COUNT(*)::int AS count
            FROM pad_docs AS d
            JOIN pad_revisions AS r ON r.doc_id = d.id
            WHERE d.pad_path = ${path} AND d.kind = 'text'
        `

        expect(history).toHaveLength(CHECKPOINT_INTERVAL + 2)
        expect(history[0]).toEqual(
            expect.objectContaining({
                id: latestRevisionId,
                revisionNumber: CHECKPOINT_INTERVAL + 2,
                isHead: true,
            }),
        )
        expect(history.at(-1)).toEqual(
            expect.objectContaining({
                id: firstRevisionId,
                revisionNumber: 1,
                isHead: false,
            }),
        )
        expect(checkpointCount?.count).toBe(1)
        expect(revisionCount?.count).toBe(CHECKPOINT_INTERVAL + 2)
        expect(stored.snapshot).not.toBeNull()
        expect(stored.updates).toHaveLength(2)

        const oldBytes = await loadPadDocRevisionBytes(
            path,
            'text',
            firstRevisionId,
        )
        const latestBytes = await loadPadDocRevisionBytes(
            path,
            'text',
            latestRevisionId,
        )
        const oldDoc = new Doc()
        const latestDoc = new Doc()
        applyUpdate(oldDoc, oldBytes)
        applyUpdate(latestDoc, latestBytes)

        expect(oldDoc.getText(Y_TEXT_KEY).toString()).toBe('1\n')
        expect(latestDoc.getText(Y_TEXT_KEY).toString()).toBe(
            Array.from(
                { length: CHECKPOINT_INTERVAL + 2 },
                (_, index) => `${index + 1}\n`,
            ).join(''),
        )

        doc.destroy()
        oldDoc.destroy()
        latestDoc.destroy()
        await cleanupRoot(root)
    })

    test('stores which snapshot a revert came from', async () => {
        const root = uniqueRoot('revert-meta')
        const path = padPath(`${root}/doc`)
        await cleanupRoot(root)
        await ensurePad(path)

        const doc = new Doc()
        const updates: Uint8Array[] = []
        doc.on('update', (update) => updates.push(update))

        doc.getText(Y_TEXT_KEY).insert(0, 'alpha')
        const first = await appendPadDocRevision(
            path,
            'text',
            mergeUpdates(updates),
            updates.length,
        )
        updates.length = 0

        doc.getText(Y_TEXT_KEY).insert(5, '\nbeta')
        await appendPadDocRevision(
            path,
            'text',
            mergeUpdates(updates),
            updates.length,
        )
        updates.length = 0

        doc.getText(Y_TEXT_KEY).delete(5, 5)
        await appendPadDocRevision(
            path,
            'text',
            mergeUpdates(updates),
            updates.length,
            first.revisionId,
        )

        const history = await listPadDocRevisions(path, 'text')

        expect(history[0]).toEqual(
            expect.objectContaining({
                revisionNumber: 3,
                revertedFromRevisionNumber: 1,
                isHead: true,
            }),
        )

        doc.destroy()
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

        expect(tree.map((item) => item.path)).toEqual(
            sortPaths([padPath(root), current, alpha, nestedAlpha, zeta]),
        )

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

        expect(tree.map((item) => item.path)).toEqual(
            sortPaths([padPath(root), current, known]),
        )
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
