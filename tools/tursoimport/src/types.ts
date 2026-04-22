import type { PadPath } from '@mpad/core/pad-path'
import type { PadDocKind } from '@mpad/core/pad-room'

export type ImportConfig = {
    configPath: string
    remoteProbeTimeoutMs: number
    sqlitePath: string
    syncTimeoutMs: number
    targetDatabaseTls: boolean
    targetDatabaseUrl: string
    tursoToken: string
    tursoUrl: string
}

export type SourceRow = {
    content: string
    id: string
    last_transaction: number | null
    last_update: number | null
}

export type LegacyPadRow = {
    content: string
    id: string
    lastTransaction: number | null
    lastUpdate: number | null
}

export type SelectedLegacyPadRow = LegacyPadRow & {
    path: PadPath
    rawIds: string[]
}

export type LegacyDrawingElement = {
    id: string
    updated?: number
    version?: number
    versionNonce?: number
    [key: string]: unknown
}

export type LegacyDrawingScene = {
    createdAtMs: number
    elements: LegacyDrawingElement[]
    key: string
}

export type ConvertedLegacyPad = {
    drawingElements: LegacyDrawingElement[]
    drawingBytes: Uint8Array
    hasDrawingContent: boolean
    hasTextContent: boolean
    path: PadPath
    rawIds: string[]
    text: string
    textBytes: Uint8Array
    updatedAt: string
    updatedAtMs: number
    usedPlaceholder: boolean
}

export type ImportedPadRow = {
    createdAt: string
    parentPath: PadPath | null
    path: PadPath
    updatedAt: string
}

export type ImportSummary = {
    configPath: string
    convertedPads: number
    drawingDocsCreated: number
    drawingRevisionsAppended: number
    duplicatePathsCollapsed: number
    emptyPads: number
    legacySource: string
    padRowsWritten: number
    placeholderPadsSkipped: number
    sourceRows: number
    sqlitePath: string
    targetDatabase: string
    targetPads: number
    textDocsCreated: number
    textRevisionsAppended: number
    unchangedDrawingDocs: number
    unchangedTextDocs: number
}

export type TargetApplyStats = {
    drawingDocsCreated: number
    drawingRevisionsAppended: number
    padRowsWritten: number
    textDocsCreated: number
    textRevisionsAppended: number
    unchangedDrawingDocs: number
    unchangedTextDocs: number
}

export type ExistingTargetPadRow = {
    created_at: Date | string
    parent_path: PadPath | null
    path: PadPath
    updated_at: Date | string
}

export type ExistingTargetDocRow = {
    doc_id: number | string
    head_revision_id: number | string | null
    head_revision_number: number | string | null
    kind: PadDocKind
    pad_path: PadPath
    snapshot: Uint8Array | null
}

export type TargetDocState = {
    docId: number
    headRevisionId: number | null
    headRevisionNumber: number | null
    kind: PadDocKind
    path: PadPath
    snapshot: Uint8Array | null
}

export type PadDocPlan = {
    kind: PadDocKind
    path: PadPath
    timestamp: string
}

export type RevisionInsertPlan = {
    bytes: Uint8Array
    docId: number
    kind: PadDocKind
    parentRevisionId: number | null
    revisionNumber: number
    timestamp: string
}

export type InsertedRevisionRow = {
    doc_id: number | string
    id: number | string
    revision_number: number | string
}
