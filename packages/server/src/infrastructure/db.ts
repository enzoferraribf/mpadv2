import { SQL } from 'bun'

export const sql = new SQL()

export async function migrate() {
    await sql`
        CREATE TABLE IF NOT EXISTS pads (
            path        TEXT PRIMARY KEY,
            parent_path TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `

    await sql`
        ALTER TABLE pads DROP CONSTRAINT IF EXISTS pads_path_check
    `

    await sql`
        ALTER TABLE pads
        ADD CONSTRAINT pads_path_check
        CHECK (path <> '/' AND path NOT LIKE '%//%' AND path ~ '^/[^[:space:]]+$')
    `

    await sql`
        ALTER TABLE pads DROP CONSTRAINT IF EXISTS pads_parent_path_check
    `

    await sql`
        ALTER TABLE pads
        ADD CONSTRAINT pads_parent_path_check
        CHECK (
            parent_path IS NULL
            OR (
                parent_path <> path
                AND parent_path <> '/'
                AND parent_path NOT LIKE '%//%'
                AND parent_path ~ '^/[^[:space:]]+$'
            )
        )
    `

    await sql`
        CREATE TABLE IF NOT EXISTS pad_doc_snapshots (
            pad_path    TEXT NOT NULL,
            kind        TEXT NOT NULL,
            snapshot    BYTEA NOT NULL,
            version     BIGINT NOT NULL DEFAULT 0,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (pad_path, kind)
        )
    `

    await sql`
        CREATE TABLE IF NOT EXISTS pad_doc_chunks (
            id          BIGSERIAL PRIMARY KEY,
            pad_path    TEXT NOT NULL,
            kind        TEXT NOT NULL,
            update      BYTEA NOT NULL,
            event_count INTEGER NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `

    await sql`
        ALTER TABLE pad_doc_snapshots DROP CONSTRAINT IF EXISTS pad_doc_snapshots_kind_check
    `

    await sql`
        ALTER TABLE pad_doc_snapshots
        ADD CONSTRAINT pad_doc_snapshots_kind_check
        CHECK (kind IN ('text', 'drawing'))
    `

    await sql`
        ALTER TABLE pad_doc_snapshots DROP CONSTRAINT IF EXISTS pad_doc_snapshots_pad_path_fkey
    `

    await sql`
        ALTER TABLE pad_doc_snapshots
        ADD CONSTRAINT pad_doc_snapshots_pad_path_fkey
        FOREIGN KEY (pad_path) REFERENCES pads(path) ON DELETE CASCADE
    `

    await sql`
        ALTER TABLE pad_doc_chunks DROP CONSTRAINT IF EXISTS pad_doc_chunks_kind_check
    `

    await sql`
        ALTER TABLE pad_doc_chunks
        ADD CONSTRAINT pad_doc_chunks_kind_check
        CHECK (kind IN ('text', 'drawing'))
    `

    await sql`
        ALTER TABLE pad_doc_chunks DROP CONSTRAINT IF EXISTS pad_doc_chunks_pad_path_fkey
    `

    await sql`
        ALTER TABLE pad_doc_chunks
        ADD CONSTRAINT pad_doc_chunks_pad_path_fkey
        FOREIGN KEY (pad_path) REFERENCES pads(path) ON DELETE CASCADE
    `

    await sql`
        DROP TABLE IF EXISTS pad_doc_updates
    `

    await sql`
        DROP TABLE IF EXISTS pad_files
    `

    await sql`CREATE INDEX IF NOT EXISTS idx_pad_doc_chunks_doc ON pad_doc_chunks(pad_path, kind, id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pads_parent_path ON pads(parent_path, path)`
}
