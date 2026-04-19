import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { sql } from './db'

type MigrationRecord = {
    version: string
}

const MIGRATIONS_TABLE = 'schema_migrations'
const MIGRATIONS_DIR = path.resolve(import.meta.dir, '../migrations')

export async function migrate() {
    await ensureMigrationTable()

    const applied = new Set(await loadAppliedMigrations())
    for (const version of listMigrationVersions()) {
        if (applied.has(version)) continue
        const sqlText = readFileSync(path.join(MIGRATIONS_DIR, version), 'utf8')
        await applySqlMigration(sqlText)
        await sql`
            INSERT INTO schema_migrations (version)
            VALUES (${version})
        `
    }
}

export async function ensureDatabaseReady() {
    const migrationTableReady = await hasTable(MIGRATIONS_TABLE)
    if (!migrationTableReady) throw new Error('Database is not migrated. Run `bun run server:schema-migrate`.')

    const applied = new Set(await loadAppliedMigrations())
    const pending = listMigrationVersions().filter((version) => !applied.has(version))
    if (pending.length > 0) {
        throw new Error(`Database has pending migrations: ${pending.join(', ')}. Run \`bun run server:schema-migrate\`.`)
    }
}

async function ensureMigrationTable() {
    await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            version    TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
}

async function loadAppliedMigrations() {
    const rows = await sql<MigrationRecord[]>`
        SELECT version
        FROM schema_migrations
        ORDER BY version
    `

    return rows.map((row) => row.version)
}

function listMigrationVersions() {
    return readdirSync(MIGRATIONS_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
}

async function applySqlMigration(sqlText: string) {
    const statements = sqlText
        .split(/;\s*\n/g)
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0)

    for (const statement of statements) {
        await sql.unsafe(`${statement};`)
    }
}

async function hasTable(name: string) {
    const [row] = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = ${name}
        ) AS exists
    `

    return row?.exists === true
}
