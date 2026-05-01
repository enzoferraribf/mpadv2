import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SQL } from 'bun'
import type { ParsedRange } from '../src/server/date-range'
import { readDashboardStats } from '../src/server/stats'

const databaseUrl = process.env.DATABASE_URL
const run = databaseUrl ? describe : describe.skip
let sql: SQL

run('dashboard stats db integration', () => {
    beforeAll(async () => {
        sql = new SQL(databaseUrl!)
        await sql`
            CREATE TEMP TABLE pads (
                id bigserial PRIMARY KEY,
                path text NOT NULL UNIQUE,
                root_path text NOT NULL,
                parent_path text,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            )
        `
        await sql`
            CREATE TEMP TABLE pad_docs (
                id bigserial PRIMARY KEY,
                pad_id bigint NOT NULL REFERENCES pads(id) ON DELETE CASCADE,
                kind text NOT NULL,
                head_revision_id bigint,
                head_revision_number bigint NOT NULL DEFAULT 0,
                checkpoint_revision_id bigint,
                checkpoint_revision_number bigint,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            )
        `
        await sql`
            CREATE TEMP TABLE pad_revisions (
                id bigserial PRIMARY KEY,
                doc_id bigint NOT NULL REFERENCES pad_docs(id) ON DELETE CASCADE,
                revision_number bigint NOT NULL,
                parent_revision_id bigint,
                reverted_from_revision_id bigint,
                update bytea NOT NULL,
                snapshot bytea,
                event_count integer NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            )
        `
    })

    afterAll(async () => {
        await sql?.close()
    })

    test('returns empty stats for an empty database', async () => {
        await truncateTables()
        const stats = await readDashboardStats(sql, range(), 'Europe/London')

        expect(stats.totals.padsCreated).toBe(0)
        expect(stats.totals.padsEdited).toBe(0)
        expect(stats.totals.textDocuments).toBe(0)
        expect(stats.totals.drawingDocuments).toBe(0)
    })

    test('counts pads, revisions, and document kinds', async () => {
        await truncateTables()

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

        const stats = await readDashboardStats(sql, range(), 'Europe/London')

        expect(stats.totals.padsCreated).toBe(2)
        expect(stats.totals.padsEdited).toBe(2)
        expect(stats.totals.textRevisions).toBe(1)
        expect(stats.totals.drawingRevisions).toBe(1)
        expect(stats.totals.textDocuments).toBe(1)
        expect(stats.totals.drawingDocuments).toBe(1)
        expect(stats.totals.totalPads).toBe(2)
        expect(stats.totals.rootPaths).toBe(1)
        expect(stats.totals.rootPathsCreated).toBe(1)
        expect(stats.totals.activeDays).toBe(2)
        expect(stats.totals.averageRevisionBytes).toBe(1)
        expect(stats.totals.latestRevisionAt).not.toBeNull()
        expect(stats.hourlyRevisions[11]).toEqual({
            hour: 11,
            revisions: 2,
        })
        expect(stats.busiestRootPaths[0]).toEqual({
            path: '/team',
            count: 2,
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

async function truncateTables() {
    await sql`TRUNCATE pad_revisions, pad_docs, pads RESTART IDENTITY`
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
