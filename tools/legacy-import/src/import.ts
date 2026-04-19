import { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@libsql/client'
import {
    type PadPath,
    padPath,
    padPathAncestors,
    parentPadPath,
} from '@mpad/core/pad-path'
import { Doc, applyUpdateV2, encodeStateAsUpdate } from 'yjs'

type SourceRow = {
    id: string
    content: string
    last_update: number | null
    last_transaction: number | null
}

type LegacyPadRow = {
    id: string
    content: string
    lastUpdate: number | null
    lastTransaction: number | null
}

type SelectedLegacyPadRow = LegacyPadRow & {
    path: PadPath
    rawIds: string[]
}

type LegacyDrawingElement = {
    id: string
    version?: number
    versionNonce?: number
    updated?: number
    [key: string]: unknown
}

type ConvertedLegacyPad = {
    path: PadPath
    rawIds: string[]
    updatedAt: string
    updatedAtMs: number
    text: string
    drawingElements: LegacyDrawingElement[]
    usedPlaceholder: boolean
}

type ImportedPadRow = {
    path: PadPath
    createdAt: string
    updatedAt: string
}

type LegacyDrawingScene = {
    createdAtMs: number
    key: string
    elements: LegacyDrawingElement[]
}

const LEGACY_EMPTY_PAD_PLACEHOLDER =
    'This pad existed but it had no content, I migrated it either way :)'
const Y_TEXT_KEY = 'text'
const Y_DRAWING_ELEMENTS_KEY = 'elements'

const repoRoot = path.resolve(import.meta.dir, '../../..')
const sqlitePath = resolvePath(
    process.env.LEGACY_SQLITE_PATH ??
        path.join(repoRoot, '.tmp/legacy-turso.db'),
)
const skipLegacySync = process.env.LEGACY_SKIP_SYNC === '1'
const targetDatabaseUrl = process.env.TARGET_DATABASE_URL
const turso = await readTursoConfig(path.join(repoRoot, '.turso'))

if (!targetDatabaseUrl) {
    throw new Error(
        'Missing TARGET_DATABASE_URL. Point it at the target Postgres database before running legacy:import.',
    )
}

if (skipLegacySync) {
    if (!existsSync(sqlitePath)) {
        throw new Error(
            `LEGACY_SKIP_SYNC=1 but no cached sqlite was found at ${sqlitePath}`,
        )
    }
} else {
    await syncLegacySqlite()
}

process.env.DATABASE_URL = targetDatabaseUrl

const { migrate } = await import(
    '../../../packages/server/src/infrastructure/migration-runner'
)
const { sql } = await import('../../../packages/server/src/infrastructure/db')

await migrate()

const sqlite = new Database(sqlitePath, { readonly: true, create: false })
const sourceRows = sqlite
    .query(`
    SELECT id, content, last_update, last_transaction
    FROM pads
    ORDER BY id ASC
`)
    .all() as SourceRow[]

const selected = selectLegacyPadRows(sourceRows.map(toLegacyPadRow))
const pads = selected.rows.map(convertLegacyPadRow)
const padRows = buildPadRows(pads)

let importedTextDocs = 0
let importedDrawingDocs = 0

await sql.begin(async (tx: typeof sql) => {
    await tx.unsafe(
        'TRUNCATE pad_revisions, pad_docs, pads RESTART IDENTITY CASCADE',
    )

    for (const row of padRows) {
        await tx`
            INSERT INTO pads (path, parent_path, created_at, updated_at)
            VALUES (${row.path}, ${parentPadPath(row.path)}, ${row.createdAt}, ${row.updatedAt})
        `
    }

    for (const pad of pads) {
        const textBytes = buildTextDocBytes(pad.text)
        if (textBytes) {
            await insertPadDoc(tx, {
                bytes: textBytes,
                kind: 'text',
                path: pad.path,
                timestamp: pad.updatedAt,
            })
            importedTextDocs += 1
        }

        const drawingBytes = buildDrawingDocBytes(pad.drawingElements)
        if (drawingBytes) {
            await insertPadDoc(tx, {
                bytes: drawingBytes,
                kind: 'drawing',
                path: pad.path,
                timestamp: pad.updatedAt,
            })
            importedDrawingDocs += 1
        }
    }
})

sqlite.close()
await sql.close()

console.log(
    JSON.stringify(
        {
            duplicatePathsCollapsed: selected.duplicatePaths,
            emptyPads: pads.filter(
                (pad) =>
                    pad.text.length === 0 && pad.drawingElements.length === 0,
            ).length,
            importedDrawingDocs,
            importedTextDocs,
            insertedPads: padRows.length,
            placeholderPadsSkipped: pads.filter((pad) => pad.usedPlaceholder)
                .length,
            sourceRows: sourceRows.length,
            sqlitePath,
            targetDatabaseUrl,
            targetPads: pads.length,
        },
        null,
        2,
    ),
)

async function syncLegacySqlite() {
    const client = createClient({
        url: `file:${sqlitePath}`,
        syncUrl: turso.databaseUrl,
        authToken: turso.databaseToken,
    })

    await client.sync()
    await client.close()
}

async function insertPadDoc(
    tx: typeof import('../../../packages/server/src/infrastructure/db').sql,
    input: {
        bytes: Uint8Array
        kind: 'drawing' | 'text'
        path: string
        timestamp: string
    },
) {
    const [doc] = await tx<{ id: number | string }[]>`
        INSERT INTO pad_docs (pad_path, kind, created_at, updated_at)
        VALUES (${input.path}, ${input.kind}, ${input.timestamp}, ${input.timestamp})
        RETURNING id
    `
    if (!doc)
        throw new Error(`Failed to insert ${input.kind} doc for ${input.path}`)

    const [revision] = await tx<{ id: number | string }[]>`
        INSERT INTO pad_revisions (
            doc_id,
            revision_number,
            parent_revision_id,
            reverted_from_revision_id,
            update,
            snapshot,
            event_count,
            created_at
        )
        VALUES (
            ${toNumber(doc.id)},
            1,
            NULL,
            NULL,
            ${input.bytes},
            ${input.bytes},
            1,
            ${input.timestamp}
        )
        RETURNING id
    `
    if (!revision)
        throw new Error(
            `Failed to insert ${input.kind} revision for ${input.path}`,
        )

    await tx`
        UPDATE pad_docs
        SET head_revision_id = ${toNumber(revision.id)}
        WHERE id = ${toNumber(doc.id)}
    `
}

async function readTursoConfig(filePath: string) {
    const text = await readFile(filePath, 'utf8')
    const values = new Map<string, string>()

    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (trimmed.length === 0 || trimmed.startsWith('#')) continue
        const index = trimmed.indexOf('=')
        if (index === -1) continue
        values.set(trimmed.slice(0, index), trimmed.slice(index + 1))
    }

    const databaseUrl = values.get('DATABASE_URL')
    const databaseToken = values.get('DATABASE_TOKEN')
    if (!databaseUrl || !databaseToken)
        throw new Error('Missing DATABASE_URL or DATABASE_TOKEN in .turso')

    return {
        databaseToken,
        databaseUrl,
    }
}

function toLegacyPadRow(row: SourceRow): LegacyPadRow {
    return {
        id: row.id,
        content: row.content,
        lastUpdate: row.last_update,
        lastTransaction: row.last_transaction,
    }
}

function selectLegacyPadRows(rows: LegacyPadRow[]) {
    const grouped = new Map<PadPath, LegacyPadRow[]>()

    for (const row of rows) {
        const path = normalizeLegacyPadPath(row.id)
        const group = grouped.get(path)
        if (group) {
            group.push(row)
            continue
        }
        grouped.set(path, [row])
    }

    const selected = Array.from(grouped.entries(), ([path, group]) => {
        const preferred = [...group].sort(compareLegacyRows)[0]!
        return {
            ...preferred,
            path,
            rawIds: group.map((row) => row.id).sort(),
        }
    }).sort((left, right) => left.path.localeCompare(right.path))

    return {
        duplicatePaths: rows.length - selected.length,
        rows: selected,
    }
}

function convertLegacyPadRow(row: SelectedLegacyPadRow): ConvertedLegacyPad {
    const doc = new Doc()
    const bytes = parseLegacyBytes(row.content)

    if (bytes.byteLength > 0) applyUpdateV2(doc, bytes)

    const { text, usedPlaceholder } = readLegacyText(doc)
    const drawingElements = readLegacyDrawingElements(doc)
    const updatedAtMs = resolveLegacyTimestampMs(row)

    doc.destroy()

    return {
        path: row.path,
        rawIds: row.rawIds,
        updatedAt: toIsoTimestamp(updatedAtMs),
        updatedAtMs,
        text,
        drawingElements,
        usedPlaceholder,
    }
}

function buildPadRows(pads: ConvertedLegacyPad[]): ImportedPadRow[] {
    const rows = new Map<
        PadPath,
        { createdAtMs: number; updatedAtMs: number }
    >()

    for (const pad of pads) {
        for (const path of padPathAncestors(pad.path)) {
            const current = rows.get(path)
            if (!current) {
                rows.set(path, {
                    createdAtMs: pad.updatedAtMs,
                    updatedAtMs: pad.updatedAtMs,
                })
                continue
            }

            current.createdAtMs = Math.min(current.createdAtMs, pad.updatedAtMs)
            current.updatedAtMs = Math.max(current.updatedAtMs, pad.updatedAtMs)
        }
    }

    return Array.from(rows.entries(), ([path, timestamps]) => ({
        path,
        createdAt: toIsoTimestamp(timestamps.createdAtMs),
        updatedAt: toIsoTimestamp(timestamps.updatedAtMs),
    })).sort(compareImportedPadRows)
}

function buildTextDocBytes(text: string) {
    if (text.length === 0) return null

    const doc = new Doc()
    doc.getText(Y_TEXT_KEY).insert(0, text)
    const bytes = encodeStateAsUpdate(doc)
    doc.destroy()

    return bytes
}

function buildDrawingDocBytes(elements: LegacyDrawingElement[]) {
    if (elements.length === 0) return null

    const doc = new Doc()
    const order = doc.getArray<string>('order')
    const map = doc.getMap<string>(Y_DRAWING_ELEMENTS_KEY)
    const ids = Array.from(new Set(elements.map((element) => element.id)))

    for (const element of elements) {
        map.set(element.id, JSON.stringify(element))
    }

    order.insert(0, ids)

    const bytes = encodeStateAsUpdate(doc)
    doc.destroy()

    return bytes
}

function normalizeLegacyPadPath(value: string): PadPath {
    return padPath(value)
}

function compareLegacyRows(left: LegacyPadRow, right: LegacyPadRow) {
    const timestampDiff =
        resolveLegacyTimestampMs(right) - resolveLegacyTimestampMs(left)
    if (timestampDiff !== 0) return timestampDiff

    const canonicalDiff =
        Number(isCanonicalLegacyId(right.id)) -
        Number(isCanonicalLegacyId(left.id))
    if (canonicalDiff !== 0) return canonicalDiff

    const contentDiff = right.content.length - left.content.length
    if (contentDiff !== 0) return contentDiff

    return left.id.localeCompare(right.id)
}

function isCanonicalLegacyId(value: string) {
    return value === normalizeLegacyPadPath(value)
}

function parseLegacyBytes(content: string) {
    if (content.length === 0) return new Uint8Array()

    const parts = content.split(',').filter((value) => value.length > 0)
    const bytes = new Uint8Array(parts.length)

    for (let index = 0; index < parts.length; index += 1) {
        const value = Number(parts[index])
        if (!Number.isInteger(value) || value < 0 || value > 255) {
            throw new Error(`Invalid legacy byte at index ${index}`)
        }
        bytes[index] = value
    }

    return bytes
}

function readLegacyText(doc: Doc) {
    const monacoText = doc.share.has('monaco')
        ? doc.getText('monaco').toString()
        : ''
    if (monacoText.length > 0) {
        return {
            text: monacoText,
            usedPlaceholder: false,
        }
    }

    const fallbackText = doc.share.has('') ? doc.getText('').toString() : ''
    if (fallbackText.length === 0) {
        return {
            text: '',
            usedPlaceholder: false,
        }
    }

    if (fallbackText === LEGACY_EMPTY_PAD_PLACEHOLDER) {
        return {
            text: '',
            usedPlaceholder: true,
        }
    }

    return {
        text: fallbackText,
        usedPlaceholder: false,
    }
}

function readLegacyDrawingElements(doc: Doc) {
    if (!doc.share.has('drawings')) return []

    const drawings = doc.getMap<unknown>('drawings').toJSON() as Record<
        string,
        unknown
    >
    const scenes = Object.entries(drawings)
        .flatMap(([key, value]) => parseLegacyDrawingScene(key, value))
        .sort(compareLegacyDrawingScenes)

    const elementsById = new Map<string, LegacyDrawingElement>()
    const order: string[] = []
    const seen = new Set<string>()

    for (const scene of scenes) {
        for (const element of scene.elements) {
            const current = elementsById.get(element.id)
            if (!current || shouldReplaceDrawingElement(current, element)) {
                elementsById.set(element.id, element)
            }

            if (seen.has(element.id)) continue
            seen.add(element.id)
            order.push(element.id)
        }
    }

    return order
        .map((id) => elementsById.get(id))
        .filter(
            (element): element is LegacyDrawingElement => element !== undefined,
        )
}

function parseLegacyDrawingScene(
    key: string,
    value: unknown,
): LegacyDrawingScene[] {
    if (!isRecord(value) || typeof value.url !== 'string') return []

    let parsed: unknown
    try {
        parsed = JSON.parse(value.url)
    } catch {
        return []
    }

    if (!isRecord(parsed) || !Array.isArray(parsed.elements)) return []

    const elements = parsed.elements.filter(isLegacyDrawingElement)
    if (elements.length === 0) return []

    return [
        {
            createdAtMs: parseLegacyCreatedAt(value.created),
            key,
            elements,
        },
    ]
}

function compareLegacyDrawingScenes(
    left: LegacyDrawingScene,
    right: LegacyDrawingScene,
) {
    if (left.createdAtMs !== right.createdAtMs)
        return left.createdAtMs - right.createdAtMs
    return left.key.localeCompare(right.key)
}

function shouldReplaceDrawingElement(
    current: LegacyDrawingElement,
    next: LegacyDrawingElement,
) {
    const nextVersion = typeof next.version === 'number' ? next.version : 0
    const currentVersion =
        typeof current.version === 'number' ? current.version : 0
    if (nextVersion !== currentVersion) return nextVersion > currentVersion

    const nextNonce =
        typeof next.versionNonce === 'number' ? next.versionNonce : 0
    const currentNonce =
        typeof current.versionNonce === 'number' ? current.versionNonce : 0
    if (nextNonce !== currentNonce) {
        return readDrawingUpdatedAt(next) >= readDrawingUpdatedAt(current)
    }

    return readDrawingUpdatedAt(next) >= readDrawingUpdatedAt(current)
}

function readDrawingUpdatedAt(element: LegacyDrawingElement) {
    return typeof element.updated === 'number' ? element.updated : 0
}

function parseLegacyCreatedAt(value: unknown) {
    if (typeof value !== 'string') return 0
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? timestamp : 0
}

function isLegacyDrawingElement(value: unknown): value is LegacyDrawingElement {
    return isRecord(value) && typeof value.id === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function resolveLegacyTimestampMs(row: LegacyPadRow) {
    return Math.max(row.lastUpdate ?? 0, row.lastTransaction ?? 0)
}

function toIsoTimestamp(value: number) {
    return new Date(value).toISOString()
}

function compareImportedPadRows(left: ImportedPadRow, right: ImportedPadRow) {
    const depthDiff = padDepth(left.path) - padDepth(right.path)
    if (depthDiff !== 0) return depthDiff
    return left.path.localeCompare(right.path)
}

function padDepth(path: PadPath) {
    return path.split('/').filter(Boolean).length
}

function toNumber(value: number | string) {
    return typeof value === 'number' ? value : Number(value)
}

function resolvePath(value: string) {
    return path.isAbsolute(value) ? value : path.resolve(repoRoot, value)
}
