import { Y_DRAWING_ELEMENTS_KEY, Y_TEXT_KEY } from '@mpad/core/pad-limits'
import {
    type PadPath,
    padPathAncestors,
    parentPadPath,
} from '@mpad/core/pad-path'
import { Doc, applyUpdateV2, encodeStateAsUpdate } from 'yjs'
import { resolveLegacyTimestampMs } from './source'
import type {
    ConvertedLegacyPad,
    ImportedPadRow,
    LegacyDrawingElement,
    LegacyDrawingScene,
    SelectedLegacyPadRow,
} from './types'
import { comparePadPathsByDepth, toIsoTimestamp } from './utils'

const LEGACY_EMPTY_PAD_PLACEHOLDER =
    'This pad existed but it had no content, I migrated it either way :)'

export function convertLegacyPadRow(
    row: SelectedLegacyPadRow,
): ConvertedLegacyPad {
    const doc = new Doc()
    const bytes = parseLegacyBytes(row.content)

    if (bytes.byteLength > 0) applyUpdateV2(doc, bytes)

    const { text, usedPlaceholder } = readLegacyText(doc)
    const drawingElements = readLegacyDrawingElements(doc)
    const updatedAtMs = resolveLegacyTimestampMs(row)

    doc.destroy()

    return {
        drawingElements,
        drawingBytes: buildDrawingDocBytes(drawingElements),
        hasDrawingContent: drawingElements.length > 0,
        hasTextContent: text.length > 0,
        path: row.path,
        rawIds: row.rawIds,
        text,
        textBytes: buildTextDocBytes(text),
        updatedAt: toIsoTimestamp(updatedAtMs),
        updatedAtMs,
        usedPlaceholder,
    }
}

export function buildPadRows(pads: ConvertedLegacyPad[]): ImportedPadRow[] {
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
        createdAt: toIsoTimestamp(timestamps.createdAtMs),
        parentPath: parentPadPath(path),
        path,
        updatedAt: toIsoTimestamp(timestamps.updatedAtMs),
    })).sort((left, right) => comparePadPathsByDepth(left.path, right.path))
}

export function buildTextDocBytes(text: string) {
    if (text.length === 0) return new Uint8Array()

    const doc = new Doc()
    doc.getText(Y_TEXT_KEY).insert(0, text)
    const bytes = encodeStateAsUpdate(doc)
    doc.destroy()

    return bytes
}

export function buildDrawingDocBytes(elements: LegacyDrawingElement[]) {
    if (elements.length === 0) return new Uint8Array()

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
            elements,
            key,
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
