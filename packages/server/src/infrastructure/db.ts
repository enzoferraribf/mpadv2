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

    if (!(await hasTable('pad_doc_revisions'))) {
        await sql`DROP TABLE IF EXISTS pad_doc_heads`
        await sql`DROP TABLE IF EXISTS pad_doc_checkpoints`
        await sql`DROP TABLE IF EXISTS pad_doc_revisions`
        await sql`DROP TABLE IF EXISTS pad_doc_snapshots`
        await sql`DROP TABLE IF EXISTS pad_doc_chunks`
    }

    await sql`
        CREATE TABLE IF NOT EXISTS pad_doc_chunks (
            seq         BIGSERIAL PRIMARY KEY,
            pad_path    TEXT NOT NULL,
            kind        TEXT NOT NULL,
            update      BYTEA NOT NULL,
            event_count INTEGER NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `

    await sql`
        CREATE TABLE IF NOT EXISTS pad_doc_revisions (
            id                  BIGSERIAL PRIMARY KEY,
            pad_path            TEXT NOT NULL,
            kind                TEXT NOT NULL,
            revision_number     BIGINT NOT NULL,
            parent_revision_id  BIGINT,
            reverted_from_revision_id BIGINT,
            chunk_seq           BIGINT NOT NULL,
            checkpoint_id       BIGINT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `

    await sql`
        ALTER TABLE pad_doc_revisions
        ADD COLUMN IF NOT EXISTS reverted_from_revision_id BIGINT
    `

    await sql`
        CREATE TABLE IF NOT EXISTS pad_doc_checkpoints (
            id          BIGSERIAL PRIMARY KEY,
            pad_path    TEXT NOT NULL,
            kind        TEXT NOT NULL,
            revision_id BIGINT NOT NULL,
            chunk_seq   BIGINT NOT NULL,
            snapshot    BYTEA NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `

    await sql`
        CREATE TABLE IF NOT EXISTS pad_doc_heads (
            pad_path          TEXT NOT NULL,
            kind              TEXT NOT NULL,
            head_revision_id  BIGINT NOT NULL,
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (pad_path, kind)
        )
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
        ALTER TABLE pad_doc_revisions DROP CONSTRAINT IF EXISTS pad_doc_revisions_kind_check
    `

    await sql`
        ALTER TABLE pad_doc_revisions
        ADD CONSTRAINT pad_doc_revisions_kind_check
        CHECK (kind IN ('text', 'drawing'))
    `

    await sql`
        ALTER TABLE pad_doc_revisions DROP CONSTRAINT IF EXISTS pad_doc_revisions_pad_path_fkey
    `

    await sql`
        ALTER TABLE pad_doc_revisions
        ADD CONSTRAINT pad_doc_revisions_pad_path_fkey
        FOREIGN KEY (pad_path) REFERENCES pads(path) ON DELETE CASCADE
    `

    await sql`
        ALTER TABLE pad_doc_revisions DROP CONSTRAINT IF EXISTS pad_doc_revisions_parent_revision_id_fkey
    `

    await sql`
        ALTER TABLE pad_doc_revisions
        ADD CONSTRAINT pad_doc_revisions_parent_revision_id_fkey
        FOREIGN KEY (parent_revision_id) REFERENCES pad_doc_revisions(id) ON DELETE SET NULL
    `

    await sql`
        ALTER TABLE pad_doc_revisions DROP CONSTRAINT IF EXISTS pad_doc_revisions_reverted_from_revision_id_fkey
    `

    await sql`
        ALTER TABLE pad_doc_revisions
        ADD CONSTRAINT pad_doc_revisions_reverted_from_revision_id_fkey
        FOREIGN KEY (reverted_from_revision_id) REFERENCES pad_doc_revisions(id) ON DELETE SET NULL
    `

    await sql`
        ALTER TABLE pad_doc_revisions DROP CONSTRAINT IF EXISTS pad_doc_revisions_chunk_seq_fkey
    `

    await sql`
        ALTER TABLE pad_doc_revisions
        ADD CONSTRAINT pad_doc_revisions_chunk_seq_fkey
        FOREIGN KEY (chunk_seq) REFERENCES pad_doc_chunks(seq) ON DELETE CASCADE
    `

    await sql`
        ALTER TABLE pad_doc_checkpoints DROP CONSTRAINT IF EXISTS pad_doc_checkpoints_kind_check
    `

    await sql`
        ALTER TABLE pad_doc_checkpoints
        ADD CONSTRAINT pad_doc_checkpoints_kind_check
        CHECK (kind IN ('text', 'drawing'))
    `

    await sql`
        ALTER TABLE pad_doc_checkpoints DROP CONSTRAINT IF EXISTS pad_doc_checkpoints_pad_path_fkey
    `

    await sql`
        ALTER TABLE pad_doc_checkpoints
        ADD CONSTRAINT pad_doc_checkpoints_pad_path_fkey
        FOREIGN KEY (pad_path) REFERENCES pads(path) ON DELETE CASCADE
    `

    await sql`
        ALTER TABLE pad_doc_checkpoints DROP CONSTRAINT IF EXISTS pad_doc_checkpoints_revision_id_fkey
    `

    await sql`
        ALTER TABLE pad_doc_checkpoints
        ADD CONSTRAINT pad_doc_checkpoints_revision_id_fkey
        FOREIGN KEY (revision_id) REFERENCES pad_doc_revisions(id) ON DELETE CASCADE
    `

    await sql`
        ALTER TABLE pad_doc_checkpoints DROP CONSTRAINT IF EXISTS pad_doc_checkpoints_chunk_seq_fkey
    `

    await sql`
        ALTER TABLE pad_doc_checkpoints
        ADD CONSTRAINT pad_doc_checkpoints_chunk_seq_fkey
        FOREIGN KEY (chunk_seq) REFERENCES pad_doc_chunks(seq) ON DELETE CASCADE
    `

    await sql`
        ALTER TABLE pad_doc_heads DROP CONSTRAINT IF EXISTS pad_doc_heads_kind_check
    `

    await sql`
        ALTER TABLE pad_doc_heads
        ADD CONSTRAINT pad_doc_heads_kind_check
        CHECK (kind IN ('text', 'drawing'))
    `

    await sql`
        ALTER TABLE pad_doc_heads DROP CONSTRAINT IF EXISTS pad_doc_heads_pad_path_fkey
    `

    await sql`
        ALTER TABLE pad_doc_heads
        ADD CONSTRAINT pad_doc_heads_pad_path_fkey
        FOREIGN KEY (pad_path) REFERENCES pads(path) ON DELETE CASCADE
    `

    await sql`
        ALTER TABLE pad_doc_heads DROP CONSTRAINT IF EXISTS pad_doc_heads_head_revision_id_fkey
    `

    await sql`
        ALTER TABLE pad_doc_heads
        ADD CONSTRAINT pad_doc_heads_head_revision_id_fkey
        FOREIGN KEY (head_revision_id) REFERENCES pad_doc_revisions(id) ON DELETE CASCADE
    `

    await sql`
        DROP TABLE IF EXISTS pad_doc_updates
    `

    await sql`
        DROP TABLE IF EXISTS pad_files
    `

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_pad_doc_revisions_number ON pad_doc_revisions(pad_path, kind, revision_number)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pad_doc_revisions_desc ON pad_doc_revisions(pad_path, kind, revision_number DESC)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pad_doc_chunks_doc ON pad_doc_chunks(pad_path, kind, seq)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pad_doc_checkpoints_doc ON pad_doc_checkpoints(pad_path, kind, chunk_seq)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pad_doc_revisions_created_at ON pad_doc_revisions(pad_path, kind, created_at DESC)`
    await sql`CREATE INDEX IF NOT EXISTS idx_pads_parent_path ON pads(parent_path, path)`
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
