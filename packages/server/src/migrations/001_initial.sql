CREATE TABLE IF NOT EXISTS pads (
    path        TEXT PRIMARY KEY,
    parent_path TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pads DROP CONSTRAINT IF EXISTS pads_path_check;
ALTER TABLE pads
ADD CONSTRAINT pads_path_check
CHECK (path <> '/' AND path NOT LIKE '%//%' AND path ~ '^/.+$');

ALTER TABLE pads DROP CONSTRAINT IF EXISTS pads_parent_path_check;
ALTER TABLE pads
ADD CONSTRAINT pads_parent_path_check
CHECK (
    parent_path IS NULL
    OR (
        parent_path <> path
        AND parent_path <> '/'
        AND parent_path NOT LIKE '%//%'
        AND parent_path ~ '^/.+$'
    )
);

CREATE TABLE IF NOT EXISTS pad_docs (
    id               BIGSERIAL PRIMARY KEY,
    pad_path         TEXT NOT NULL,
    kind             TEXT NOT NULL,
    head_revision_id BIGINT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pad_path, kind)
);

ALTER TABLE pad_docs DROP CONSTRAINT IF EXISTS pad_docs_kind_check;
ALTER TABLE pad_docs
ADD CONSTRAINT pad_docs_kind_check
CHECK (kind IN ('text', 'drawing'));

ALTER TABLE pad_docs DROP CONSTRAINT IF EXISTS pad_docs_pad_path_fkey;
ALTER TABLE pad_docs
ADD CONSTRAINT pad_docs_pad_path_fkey
FOREIGN KEY (pad_path) REFERENCES pads(path) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS pad_revisions (
    id                        BIGSERIAL PRIMARY KEY,
    doc_id                    BIGINT NOT NULL,
    revision_number           BIGINT NOT NULL,
    parent_revision_id        BIGINT,
    reverted_from_revision_id BIGINT,
    update                    BYTEA NOT NULL,
    snapshot                  BYTEA,
    event_count               INTEGER NOT NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (doc_id, revision_number)
);

ALTER TABLE pad_revisions DROP CONSTRAINT IF EXISTS pad_revisions_doc_id_fkey;
ALTER TABLE pad_revisions
ADD CONSTRAINT pad_revisions_doc_id_fkey
FOREIGN KEY (doc_id) REFERENCES pad_docs(id) ON DELETE CASCADE;

ALTER TABLE pad_revisions DROP CONSTRAINT IF EXISTS pad_revisions_parent_revision_id_fkey;
ALTER TABLE pad_revisions
ADD CONSTRAINT pad_revisions_parent_revision_id_fkey
FOREIGN KEY (parent_revision_id) REFERENCES pad_revisions(id) ON DELETE SET NULL;

ALTER TABLE pad_revisions DROP CONSTRAINT IF EXISTS pad_revisions_reverted_from_revision_id_fkey;
ALTER TABLE pad_revisions
ADD CONSTRAINT pad_revisions_reverted_from_revision_id_fkey
FOREIGN KEY (reverted_from_revision_id) REFERENCES pad_revisions(id) ON DELETE SET NULL;

ALTER TABLE pad_docs DROP CONSTRAINT IF EXISTS pad_docs_head_revision_id_fkey;
ALTER TABLE pad_docs
ADD CONSTRAINT pad_docs_head_revision_id_fkey
FOREIGN KEY (head_revision_id) REFERENCES pad_revisions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pads_parent_path ON pads(parent_path, path);
CREATE INDEX IF NOT EXISTS idx_pad_docs_path_kind ON pad_docs(pad_path, kind);
CREATE INDEX IF NOT EXISTS idx_pad_revisions_doc_desc ON pad_revisions(doc_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_pad_revisions_doc_created_at ON pad_revisions(doc_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pad_revisions_doc_snapshot ON pad_revisions(doc_id, revision_number DESC) WHERE snapshot IS NOT NULL;
