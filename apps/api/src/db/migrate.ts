import path from 'node:path'
import type { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate as migrateWithDrizzle } from 'drizzle-orm/bun-sql/migrator'
import { sql } from '#/db/client'

const MIGRATIONS_DIR = path.resolve(import.meta.dir, 'migrations')

export async function migrate(client: SQL = sql) {
    await migrateWithDrizzle(drizzle({ client }), {
        migrationsFolder: MIGRATIONS_DIR,
    })
}

export async function ensureDatabaseReady() {
    await sql`SELECT 1`
}
