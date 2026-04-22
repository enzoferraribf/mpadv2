import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
} from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { padPath } from '@mpad/core/pad-path'
import { Doc, applyUpdate } from 'yjs'
import { loadImportConfig } from './config'
import {
    buildDrawingDocBytes,
    buildPadRows,
    buildTextDocBytes,
} from './convert'
import { createSilentLogger } from './log'
import { syncLegacyReplica } from './source'
import {
    applyLegacyImport,
    migrateTargetDatabase,
    openTargetDatabase,
} from './target'
import type { ConvertedLegacyPad, LegacyDrawingElement } from './types'
import { toIsoTimestamp } from './utils'

const databaseUrl = process.env.DATABASE_URL
const logger = createSilentLogger()
const sql = databaseUrl ? openTargetDatabase(databaseUrl, false) : null

if (sql) {
    beforeAll(async () => {
        await migrateTargetDatabase(sql)
    })

    beforeEach(async () => {
        await sql.unsafe(
            'TRUNCATE TABLE pad_revisions, pad_docs, pads RESTART IDENTITY CASCADE',
        )
    })

    afterAll(async () => {
        await sql.close()
    })
}

describe('tursoimport config', () => {
    test('reads module-local config values from a file', async () => {
        const tempDir = await mkdtemp(
            path.join(tmpdir(), 'tursoimport-config-'),
        )
        const sqlitePath = path.join(tempDir, 'cache', 'legacy.db')
        const configPath = path.join(tempDir, '.env.local')

        await writeFile(
            configPath,
            [
                'TURSOIMPORT_TURSO_URL=https://example.turso.io',
                'TURSOIMPORT_TURSO_TOKEN=token',
                'TURSOIMPORT_TARGET_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/db',
                `TURSOIMPORT_SQLITE_PATH=${sqlitePath}`,
                'TURSOIMPORT_REMOTE_PROBE_TIMEOUT_MS=111',
                'TURSOIMPORT_SYNC_TIMEOUT_MS=222',
            ].join('\n'),
        )

        const config = await loadImportConfig(configPath)

        expect(config).toMatchObject({
            configPath,
            remoteProbeTimeoutMs: 111,
            sqlitePath,
            syncTimeoutMs: 222,
            targetDatabaseUrl: 'postgres://user:pass@127.0.0.1:5432/db',
            tursoToken: 'token',
            tursoUrl: 'https://example.turso.io',
        })
    })

    test('fails clearly when a required key is missing', async () => {
        const tempDir = await mkdtemp(
            path.join(tmpdir(), 'tursoimport-config-missing-'),
        )
        const configPath = path.join(tempDir, '.env.local')

        await writeFile(
            configPath,
            [
                'TURSOIMPORT_TURSO_URL=https://example.turso.io',
                'TURSOIMPORT_TARGET_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/db',
            ].join('\n'),
        )

        await expect(loadImportConfig(configPath)).rejects.toThrow(
            'Missing TURSOIMPORT_TURSO_TOKEN',
        )
    })
})

describe('legacy sqlite sync', () => {
    test('creates the sqlite cache directory automatically', async () => {
        const root = await mkdtemp(path.join(tmpdir(), 'legacy-sync-'))
        const sqlitePath = path.join(root, 'nested', 'cache', 'legacy.db')
        const events: string[] = []
        let closed = false

        await syncLegacyReplica({
            authToken: 'token',
            createReplicaClient(input) {
                events.push(
                    JSON.stringify({
                        authToken: input.authToken,
                        syncUrl: input.syncUrl,
                        url: input.url,
                    }),
                )

                return {
                    close() {
                        closed = true
                    },
                    async sync() {
                        return {
                            frame_no: 1,
                            frames_synced: 2,
                        }
                    },
                }
            },
            sqlitePath,
            syncUrl: 'https://example.turso.io',
        })

        expect(events).toHaveLength(1)
        expect(events[0]).toContain(`file:${sqlitePath}`)
        expect(closed).toBe(true)
        await expect(
            mkdir(path.dirname(sqlitePath), { recursive: false }),
        ).rejects.toThrow()
    })
})

const dbDescribe = sql ? describe : describe.skip

dbDescribe('incremental target import', () => {
    test('imports pads into an empty target', async () => {
        const pads = [
            legacyPad({
                path: '/team/doc',
                text: 'hello',
                updatedAtMs: 1_000,
            }),
            legacyPad({
                drawingElements: [drawingElement('shape-1')],
                path: '/team/sketch',
                updatedAtMs: 2_000,
            }),
        ]

        const stats = await runImport(pads)

        expect(stats).toMatchObject({
            drawingDocsCreated: 1,
            drawingRevisionsAppended: 1,
            padRowsWritten: 3,
            textDocsCreated: 1,
            textRevisionsAppended: 1,
        })
        expect(await countPadRows()).toBe(3)
        expect(await countDocRevisions('/team/doc', 'text')).toBe(1)
        expect(await countDocRevisions('/team/sketch', 'drawing')).toBe(1)
        expect(await readHeadText('/team/doc')).toBe('hello')
        expect(await readHeadDrawingOrder('/team/sketch')).toEqual(['shape-1'])
    })

    test('does zero writes on a no-change rerun', async () => {
        await runImport([
            legacyPad({
                path: '/same/doc',
                text: 'hello',
                updatedAtMs: 1_000,
            }),
        ])
        const revisionCountBefore = await countDocRevisions('/same/doc', 'text')

        const stats = await runImport([
            legacyPad({
                path: '/same/doc',
                text: 'hello',
                updatedAtMs: 1_000,
            }),
        ])

        expect(stats).toMatchObject({
            drawingDocsCreated: 0,
            drawingRevisionsAppended: 0,
            padRowsWritten: 0,
            textDocsCreated: 0,
            textRevisionsAppended: 0,
        })
        expect(await countDocRevisions('/same/doc', 'text')).toBe(
            revisionCountBefore,
        )
    })

    test('appends one text revision when text changes', async () => {
        const initial = [
            legacyPad({ path: '/text/doc', text: 'hello', updatedAtMs: 1_000 }),
        ]
        const changed = [
            legacyPad({
                path: '/text/doc',
                text: 'hello world',
                updatedAtMs: 2_000,
            }),
        ]

        await runImport(initial)
        const stats = await runImport(changed)

        expect(stats.textRevisionsAppended).toBe(1)
        expect(stats.drawingRevisionsAppended).toBe(0)
        expect(await countDocRevisions('/text/doc', 'text')).toBe(2)
        expect(await readHeadText('/text/doc')).toBe('hello world')
    })

    test('appends one drawing revision when drawing changes', async () => {
        const initial = [
            legacyPad({
                drawingElements: [drawingElement('shape-1')],
                path: '/draw/doc',
                updatedAtMs: 1_000,
            }),
        ]
        const changed = [
            legacyPad({
                drawingElements: [
                    drawingElement('shape-1'),
                    drawingElement('shape-2'),
                ],
                path: '/draw/doc',
                updatedAtMs: 2_000,
            }),
        ]

        await runImport(initial)
        const stats = await runImport(changed)

        expect(stats.textRevisionsAppended).toBe(0)
        expect(stats.drawingRevisionsAppended).toBe(1)
        expect(await countDocRevisions('/draw/doc', 'drawing')).toBe(2)
        expect(await readHeadDrawingOrder('/draw/doc')).toEqual([
            'shape-1',
            'shape-2',
        ])
    })

    test('appends a clearing revision when text becomes empty', async () => {
        await runImport([
            legacyPad({
                path: '/clear/doc',
                text: 'to be cleared',
                updatedAtMs: 1_000,
            }),
        ])

        const stats = await runImport([
            legacyPad({
                path: '/clear/doc',
                text: '',
                updatedAtMs: 2_000,
            }),
        ])

        expect(stats.textRevisionsAppended).toBe(1)
        expect(await countDocRevisions('/clear/doc', 'text')).toBe(2)
        expect(await readHeadText('/clear/doc')).toBe('')
    })

    test('keeps pads that disappeared from legacy', async () => {
        await runImport([
            legacyPad({
                path: '/keep/a',
                text: 'alpha',
                updatedAtMs: 1_000,
            }),
            legacyPad({
                path: '/keep/b',
                text: 'beta',
                updatedAtMs: 1_000,
            }),
        ])

        const stats = await runImport([
            legacyPad({
                path: '/keep/a',
                text: 'alpha',
                updatedAtMs: 1_000,
            }),
        ])

        expect(stats.textRevisionsAppended).toBe(0)
        expect(await countDocRevisions('/keep/b', 'text')).toBe(1)
        expect(await readHeadText('/keep/b')).toBe('beta')
    })

    test('fails when a touched target doc has no head snapshot', async () => {
        if (!sql) throw new Error('Missing SQL client')

        await sql`
            INSERT INTO pads (path, parent_path, created_at, updated_at)
            VALUES ('/broken/doc', '/broken', NOW(), NOW())
            ON CONFLICT (path) DO NOTHING
        `
        await sql`
            INSERT INTO pads (path, parent_path, created_at, updated_at)
            VALUES ('/broken', NULL, NOW(), NOW())
            ON CONFLICT (path) DO NOTHING
        `

        const [doc] = await sql<{ id: number }[]>`
            INSERT INTO pad_docs (pad_path, kind, created_at, updated_at)
            VALUES ('/broken/doc', 'text', NOW(), NOW())
            RETURNING id
        `
        const [revision] = await sql<{ id: number }[]>`
            INSERT INTO pad_revisions (
                doc_id,
                revision_number,
                parent_revision_id,
                reverted_from_revision_id,
                update,
                snapshot,
                event_count,
                created_at
            )
            VALUES (
                ${doc!.id},
                1,
                NULL,
                NULL,
                ${new Uint8Array()},
                NULL,
                1,
                NOW()
            )
            RETURNING id
        `
        await sql`
            UPDATE pad_docs
            SET head_revision_id = ${revision!.id}
            WHERE id = ${doc!.id}
        `

        await expect(
            runImport([
                legacyPad({
                    path: '/broken/doc',
                    text: 'next',
                    updatedAtMs: 1_000,
                }),
            ]),
        ).rejects.toThrow('importer-compatible')
    })
})

async function runImport(pads: ConvertedLegacyPad[]) {
    if (!sql) throw new Error('Missing SQL client')
    return applyLegacyImport(sql, pads, buildPadRows(pads), logger)
}

function legacyPad(input: {
    drawingElements?: LegacyDrawingElement[]
    path: string
    text?: string
    updatedAtMs: number
}) {
    const drawingElements = input.drawingElements ?? []
    const text = input.text ?? ''
    const pathValue = padPath(input.path)

    return {
        drawingElements,
        drawingBytes: buildDrawingDocBytes(drawingElements),
        hasDrawingContent: drawingElements.length > 0,
        hasTextContent: text.length > 0,
        path: pathValue,
        rawIds: [pathValue],
        text,
        textBytes: buildTextDocBytes(text),
        updatedAt: toIsoTimestamp(input.updatedAtMs),
        updatedAtMs: input.updatedAtMs,
        usedPlaceholder: false,
    } satisfies ConvertedLegacyPad
}

function drawingElement(id: string): LegacyDrawingElement {
    return {
        id,
        type: 'rectangle',
        updated: 1,
        version: 1,
        versionNonce: 1,
    }
}

async function countPadRows() {
    if (!sql) throw new Error('Missing SQL client')
    const [row] = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM pads
    `
    return row?.count ?? 0
}

async function countDocRevisions(pathValue: string, kind: 'drawing' | 'text') {
    if (!sql) throw new Error('Missing SQL client')
    const [row] = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM pad_docs AS d
        JOIN pad_revisions AS r ON r.doc_id = d.id
        WHERE d.pad_path = ${padPath(pathValue)} AND d.kind = ${kind}
    `
    return row?.count ?? 0
}

async function readHeadText(pathValue: string) {
    const snapshot = await readHeadSnapshot(pathValue, 'text')
    const doc = new Doc()
    if (snapshot.byteLength > 0) applyUpdate(doc, snapshot)
    const text = doc.getText(Y_TEXT_KEY).toString()
    doc.destroy()
    return text
}

async function readHeadDrawingOrder(pathValue: string) {
    const snapshot = await readHeadSnapshot(pathValue, 'drawing')
    const doc = new Doc()
    if (snapshot.byteLength > 0) applyUpdate(doc, snapshot)
    const order = doc.getArray<string>('order').toArray()
    doc.destroy()
    return order
}

async function readHeadSnapshot(pathValue: string, kind: 'drawing' | 'text') {
    if (!sql) throw new Error('Missing SQL client')
    const [row] = await sql<{ snapshot: Uint8Array }[]>`
        SELECT r.snapshot
        FROM pad_docs AS d
        JOIN pad_revisions AS r ON r.id = d.head_revision_id
        WHERE d.pad_path = ${padPath(pathValue)} AND d.kind = ${kind}
    `

    return row ? new Uint8Array(row.snapshot) : new Uint8Array()
}
