import { sql } from 'drizzle-orm'
import {
    bigint,
    bigserial,
    check,
    customType,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    unique,
} from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Uint8Array }>({
    dataType() {
        return 'bytea'
    },
})

export const pads = pgTable(
    'pads',
    {
        id: bigserial('id', { mode: 'number' }).primaryKey(),
        path: text('path').notNull().unique(),
        rootPath: text('root_path').notNull(),
        parentPath: text('parent_path'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check(
            'pads_path_check',
            sql`${table.path} <> '/' AND ${table.path} NOT LIKE '%//%' AND ${table.path} ~ '^/.+$'`,
        ),
        check(
            'pads_path_launch_check',
            sql`octet_length(${table.path}) <= 512 AND ${table.path} !~ '[[:cntrl:]]' AND ${table.path} NOT LIKE '%\\%%' ESCAPE '\\'`,
        ),
        check(
            'pads_root_path_check',
            sql`${table.rootPath} <> '/' AND ${table.rootPath} NOT LIKE '%//%' AND ${table.rootPath} ~ '^/.+$' AND (${table.path} = ${table.rootPath} OR ${table.path} LIKE ${table.rootPath} || '/%')`,
        ),
        check(
            'pads_root_path_launch_check',
            sql`octet_length(${table.rootPath}) <= 512 AND ${table.rootPath} !~ '[[:cntrl:]]' AND ${table.rootPath} NOT LIKE '%\\%%' ESCAPE '\\'`,
        ),
        check(
            'pads_parent_path_check',
            sql`${table.parentPath} IS NULL OR (${table.parentPath} <> ${table.path} AND ${table.parentPath} <> '/' AND ${table.parentPath} NOT LIKE '%//%' AND ${table.parentPath} ~ '^/.+$')`,
        ),
        check(
            'pads_parent_path_launch_check',
            sql`${table.parentPath} IS NULL OR (octet_length(${table.parentPath}) <= 512 AND ${table.parentPath} !~ '[[:cntrl:]]' AND ${table.parentPath} NOT LIKE '%\\%%' ESCAPE '\\')`,
        ),
        index('idx_pads_root_path').on(table.rootPath, table.path),
        index('idx_pads_parent_path').on(table.parentPath, table.path),
    ],
)

export const padDocs = pgTable(
    'pad_docs',
    {
        id: bigserial('id', { mode: 'number' }).primaryKey(),
        padId: bigint('pad_id', { mode: 'number' })
            .notNull()
            .references(() => pads.id, { onDelete: 'cascade' }),
        kind: text('kind').notNull(),
        headRevisionId: bigint('head_revision_id', { mode: 'number' }),
        headRevisionNumber: bigint('head_revision_number', { mode: 'number' })
            .notNull()
            .default(0),
        checkpointRevisionId: bigint('checkpoint_revision_id', {
            mode: 'number',
        }),
        checkpointRevisionNumber: bigint('checkpoint_revision_number', {
            mode: 'number',
        }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check('pad_docs_kind_check', sql`${table.kind} IN ('text', 'drawing')`),
        unique('pad_docs_pad_kind_unique').on(table.padId, table.kind),
        index('idx_pad_docs_pad_kind').on(table.padId, table.kind),
    ],
)

export const padRevisions = pgTable(
    'pad_revisions',
    {
        id: bigserial('id', { mode: 'number' }).primaryKey(),
        docId: bigint('doc_id', { mode: 'number' })
            .notNull()
            .references(() => padDocs.id, { onDelete: 'cascade' }),
        revisionNumber: bigint('revision_number', { mode: 'number' }).notNull(),
        parentRevisionId: bigint('parent_revision_id', { mode: 'number' }),
        revertedFromRevisionId: bigint('reverted_from_revision_id', {
            mode: 'number',
        }),
        update: bytea('update').notNull(),
        snapshot: bytea('snapshot'),
        eventCount: integer('event_count').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        unique('pad_revisions_doc_revision_number_unique').on(
            table.docId,
            table.revisionNumber,
        ),
        index('idx_pad_revisions_doc_desc').on(
            table.docId,
            table.revisionNumber.desc(),
        ),
        index('idx_pad_revisions_doc_created_at').on(
            table.docId,
            table.createdAt.desc(),
        ),
        index('idx_pad_revisions_doc_snapshot')
            .on(table.docId, table.revisionNumber.desc())
            .where(sql`${table.snapshot} IS NOT NULL`),
    ],
)
