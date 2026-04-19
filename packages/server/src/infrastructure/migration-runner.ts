import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { sql } from '#/infrastructure/db'

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
    await sql`SELECT 1`
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

async function ensureMigrationTable() {
    await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            version    TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
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
