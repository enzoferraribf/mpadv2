import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    dialect: 'postgresql',
    out: './apps/api/src/db/migrations',
    schema: './apps/api/src/db/schema.ts',
    dbCredentials: {
        url: process.env.DATABASE_URL ?? '',
    },
})
