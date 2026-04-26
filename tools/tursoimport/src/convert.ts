import {
    type PadPath,
    padPathAncestors,
    parentPadPath,
    rootPadPath,
} from '@mpad/core/pad-path'
import {
    buildDrawingDocBytes,
    buildTextDocBytes,
    readLegacyPadContent,
} from './convert-docs'
import { resolveLegacyTimestampMs } from './source'
import type {
    ConvertedLegacyPad,
    ImportedPadRow,
    SelectedLegacyPadRow,
} from './types'
import { comparePadPathsByDepth, toIsoTimestamp } from './utils'

export { buildDrawingDocBytes, buildTextDocBytes } from './convert-docs'

export function convertLegacyPadRow(
    row: SelectedLegacyPadRow,
): ConvertedLegacyPad {
    const { drawingElements, text, usedPlaceholder } = readLegacyPadContent(
        row.content,
    )
    const updatedAtMs = resolveLegacyTimestampMs(row)

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
        rootPath: rootPadPath(path),
        updatedAt: toIsoTimestamp(timestamps.updatedAtMs),
    })).sort((left, right) => comparePadPathsByDepth(left.path, right.path))
}
