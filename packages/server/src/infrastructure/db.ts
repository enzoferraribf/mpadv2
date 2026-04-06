import { SQL } from 'bun'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL. Start Postgres and set DATABASE_URL before running the server.')
}

export const sql = new SQL(databaseUrl)
