import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
} from 'bun:test'
import { SQL } from 'bun'
import type { ParsedRange } from '../src/server/date-range'
import { readDashboardStats } from '../src/server/stats'

const databaseUrl = process.env.DATABASE_URL
const run = databaseUrl ? describe : describe.skip
let sql: SQL

run('dashboard stats db integration', () => {
    beforeAll(async () => {
        sql = new SQL(databaseUrl!)
        await resetSchema()
    })

    beforeEach(async () => {
        await sql`TRUNCATE pad_revisions, pad_docs, pads RESTART IDENTITY`
    })

    afterAll(async () => {
        await sql?.close()
    })

    test('summarizes activity and stale pads from real tables', async () => {
        await insertDoc({
            path: '/team/a',
            rootPath: '/team',
            kind: 'text',
            createdAt: '2026-05-01T10:00:00Z',
        })
        await insertDoc({
            path: '/team/b',
            rootPath: '/team',
            kind: 'drawing',
            createdAt: '2026-05-02T10:00:00Z',
        })
        await insertDoc({
            path: '/archive/a',
            rootPath: '/archive',
            kind: 'text',
            createdAt: '2026-04-01T10:00:00Z',
        })

        const stats = await readDashboardStats(sql, range(), 'Europe/London')

        expect(stats.totals).toMatchObject({
            padsCreated: 2,
            padsEdited: 2,
            textRevisions: 1,
            drawingRevisions: 1,
            textDocuments: 2,
            drawingDocuments: 1,
            rootPaths: 2,
            activeRootPaths: 1,
        })
        expect(stats.dailyActivity).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    date: '2026-05-01',
                    padsCreated: 1,
                    padsEdited: 1,
                    textRevisions: 1,
                }),
                expect.objectContaining({
                    date: '2026-05-02',
                    padsCreated: 1,
                    padsEdited: 1,
                    drawingRevisions: 1,
                }),
            ]),
        )
        expect(stats.topEditedPads.map((pad) => pad.path)).toEqual([
            '/team/a',
            '/team/b',
        ])
        expect(stats.stalePads[0]).toMatchObject({
            path: '/archive/a',
            revisions: 1,
        })
    })
})

function range(): ParsedRange {
    return {
        from: '2026-05-01',
        to: '2026-05-03',
        startUtc: new Date('2026-05-01T00:00:00Z'),
        endUtc: new Date('2026-05-04T00:00:00Z'),
        days: ['2026-05-01', '2026-05-02', '2026-05-03'],
    }
}

async function resetSchema() {
    await sql`DROP TABLE IF EXISTS pad_revisions, pad_docs, pads CASCADE`
    for (const migration of [
        '0000_colossal_lethal_legion.sql',
        '0001_relax_legacy_pad_path_constraints.sql',
    ]) {
        const file = Bun.file(
            new URL(
                `../../api/src/db/migrations/${migration}`,
                import.meta.url,
            ),
        )
        const statements = (await file.text())
            .split('--> statement-breakpoint')
            .map((statement) => statement.trim())
            .filter(Boolean)

        for (const statement of statements) {
            await sql.unsafe(statement)
        }
    }
}

async function insertDoc(input: {
    path: string
    rootPath: string
    kind: 'text' | 'drawing'
    createdAt: string
}) {
    const [pad] = await sql<{ id: number }[]>`
        INSERT INTO pads (path, root_path, created_at, updated_at)
        VALUES (${input.path}, ${input.rootPath}, ${input.createdAt}, ${input.createdAt})
        RETURNING id
    `
    const [doc] = await sql<{ id: number }[]>`
        INSERT INTO pad_docs (pad_id, kind, head_revision_number, created_at, updated_at)
        VALUES (${pad!.id}, ${input.kind}, 0, ${input.createdAt}, ${input.createdAt})
        RETURNING id
    `
    const [revision] = await sql<{ id: number }[]>`
        INSERT INTO pad_revisions (doc_id, revision_number, update, event_count, created_at)
        VALUES (${doc!.id}, 1, ${new Uint8Array([1])}, 1, ${input.createdAt})
        RETURNING id
    `
    await sql`
        UPDATE pad_docs
        SET head_revision_id = ${revision!.id}, head_revision_number = 1
        WHERE id = ${doc!.id}
    `
}
