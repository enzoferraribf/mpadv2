import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { padPath } from '@mpad/core/pad-path'
import type { SQL } from 'bun'
import { Doc, applyUpdate } from 'yjs'
import {
    buildDrawingDocBytes,
    buildPadRows,
    buildTextDocBytes,
} from './convert'
import { applyLegacyImport } from './target'
import type { ConvertedLegacyPad, LegacyDrawingElement } from './types'
import { toIsoTimestamp } from './utils'

export function legacyPad(input: {
    drawingElements?: LegacyDrawingElement[]
    path: string
    text?: string
    updatedAtMs: number
}) {
    const drawingElements = input.drawingElements ?? []
    const text = input.text ?? ''
    const pathValue = padPath(input.path)

    return {
        drawingElements,
        drawingBytes: buildDrawingDocBytes(drawingElements),
        hasDrawingContent: drawingElements.length > 0,
        hasTextContent: text.length > 0,
        path: pathValue,
        rawIds: [pathValue],
        text,
        textBytes: buildTextDocBytes(text),
        updatedAt: toIsoTimestamp(input.updatedAtMs),
        updatedAtMs: input.updatedAtMs,
        usedPlaceholder: false,
    } satisfies ConvertedLegacyPad
}

export function importedPad(input: {
    drawingElements?: LegacyDrawingElement[]
    path: string
    text?: string
    updatedAtMs: number
}) {
    const drawingElements = input.drawingElements ?? []
    const text = input.text ?? ''
    const pathValue = input.path as ConvertedLegacyPad['path']

    return {
        drawingElements,
        drawingBytes: buildDrawingDocBytes(drawingElements),
        hasDrawingContent: drawingElements.length > 0,
        hasTextContent: text.length > 0,
        path: pathValue,
        rawIds: [pathValue],
        text,
        textBytes: buildTextDocBytes(text),
        updatedAt: toIsoTimestamp(input.updatedAtMs),
        updatedAtMs: input.updatedAtMs,
        usedPlaceholder: false,
    } satisfies ConvertedLegacyPad
}

export function drawingElement(id: string): LegacyDrawingElement {
    return {
        id,
        type: 'rectangle',
        updated: 1,
        version: 1,
        versionNonce: 1,
    }
}

export async function runImport(
    sql: SQL,
    pads: ConvertedLegacyPad[],
    logger: Parameters<typeof applyLegacyImport>[3],
) {
    return applyLegacyImport(sql, pads, buildPadRows(pads), logger)
}

export async function countPadRows(sql: SQL) {
    const [row] = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM pads
    `
    return row?.count ?? 0
}

export async function countDocRevisions(
    sql: SQL,
    pathValue: string,
    kind: 'drawing' | 'text',
) {
    const [row] = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM pad_docs AS d
        JOIN pads AS p ON p.id = d.pad_id
        JOIN pad_revisions AS r ON r.doc_id = d.id
        WHERE p.path = ${pathValue} AND d.kind = ${kind}
    `
    return row?.count ?? 0
}

export async function readHeadText(sql: SQL, pathValue: string) {
    const snapshot = await readHeadSnapshot(sql, pathValue, 'text')
    const doc = new Doc()
    if (snapshot.byteLength > 0) applyUpdate(doc, snapshot)
    const text = doc.getText(Y_TEXT_KEY).toString()
    doc.destroy()
    return text
}

export async function readHeadDrawingOrder(sql: SQL, pathValue: string) {
    const snapshot = await readHeadSnapshot(sql, pathValue, 'drawing')
    const doc = new Doc()
    if (snapshot.byteLength > 0) applyUpdate(doc, snapshot)
    const order = doc.getArray<string>('order').toArray()
    doc.destroy()
    return order
}

async function readHeadSnapshot(
    sql: SQL,
    pathValue: string,
    kind: 'drawing' | 'text',
) {
    const [row] = await sql<{ snapshot: Uint8Array }[]>`
        SELECT r.snapshot
        FROM pad_docs AS d
        JOIN pads AS p ON p.id = d.pad_id
        JOIN pad_revisions AS r ON r.id = d.head_revision_id
        WHERE p.path = ${pathValue} AND d.kind = ${kind}
    `

    return row ? new Uint8Array(row.snapshot) : new Uint8Array()
}
