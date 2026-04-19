import type {
    PadTextHistoryEntry,
    PadTextHistoryRevision,
} from '@/pad-text/infrastructure/browser-pad-text-history'
import { assertNever } from '@mpad/core/assert'

export type CompareSource =
    | { kind: 'current' }
    | { kind: 'revision'; revisionId: number }

export type DiffSelection = {
    leftRevisionId: number | null
    rightSource: CompareSource
}

export type RevisionLoadState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; revision: PadTextHistoryRevision }

export type HistoryWorkspaceState =
    | {
          kind: 'closed'
          entries: PadTextHistoryEntry[]
          selection: DiffSelection
      }
    | {
          kind: 'loading'
          entries: PadTextHistoryEntry[]
          selection: DiffSelection
      }
    | {
          kind: 'error'
          entries: PadTextHistoryEntry[]
          message: string
          selection: DiffSelection
      }
    | {
          kind: 'ready'
          entries: PadTextHistoryEntry[]
          pendingRevertRevisionId: number | null
          selection: DiffSelection
      }

export type HistoryWorkspaceEvent =
    | { kind: 'closed' }
    | { kind: 'loading-started' }
    | { kind: 'loading-succeeded'; entries: PadTextHistoryEntry[] }
    | { kind: 'loading-failed'; message: string }
    | { kind: 'left-selected'; revisionId: number }
    | { kind: 'right-current-selected' }
    | { kind: 'right-selected'; revisionId: number }
    | { kind: 'revert-started'; revisionId: number }
    | { kind: 'revert-succeeded'; entry: PadTextHistoryEntry }
    | { kind: 'revert-finished' }

export type PadHistoryMainState =
    | { kind: 'loading'; label: string }
    | { kind: 'empty'; label: string }
    | { kind: 'error'; label: string }
    | {
          kind: 'ready'
          leftContent: string
          rightContent: string
      }

const currentSource: CompareSource = { kind: 'current' }

export function createClosedHistoryWorkspaceState(): HistoryWorkspaceState {
    return {
        kind: 'closed',
        entries: [],
        selection: createDefaultSelection(),
    }
}

export function reduceHistoryWorkspaceState(
    state: HistoryWorkspaceState,
    event: HistoryWorkspaceEvent,
): HistoryWorkspaceState {
    switch (event.kind) {
        case 'closed':
            return createClosedHistoryWorkspaceState()
        case 'loading-started':
            return {
                kind: 'loading',
                entries: state.entries,
                selection: state.selection,
            }
        case 'loading-succeeded':
            return {
                kind: 'ready',
                entries: event.entries,
                pendingRevertRevisionId: null,
                selection: reconcileSelection(event.entries, state.selection),
            }
        case 'loading-failed':
            return {
                kind: 'error',
                entries: [],
                message: event.message,
                selection: createDefaultSelection(),
            }
        case 'left-selected':
            return updateSelection(state, {
                leftRevisionId: event.revisionId,
                rightSource: state.selection.rightSource,
            })
        case 'right-current-selected':
            return updateSelection(state, {
                leftRevisionId: state.selection.leftRevisionId,
                rightSource: currentSource,
            })
        case 'right-selected':
            return updateSelection(state, {
                leftRevisionId: state.selection.leftRevisionId,
                rightSource: { kind: 'revision', revisionId: event.revisionId },
            })
        case 'revert-started':
            if (state.kind !== 'ready') return state
            return {
                ...state,
                pendingRevertRevisionId: event.revisionId,
            }
        case 'revert-succeeded': {
            const entries = [
                event.entry,
                ...state.entries.map((value) => ({
                    ...value,
                    isHead: false,
                })),
            ]

            return {
                kind: 'ready',
                entries,
                pendingRevertRevisionId:
                    state.kind === 'ready'
                        ? state.pendingRevertRevisionId
                        : null,
                selection: reconcileSelection(entries, state.selection),
            }
        }
        case 'revert-finished':
            if (state.kind !== 'ready') return state
            return {
                ...state,
                pendingRevertRevisionId: null,
            }
    }

    return assertNever(event)
}

export function readMainState(input: {
    currentContent: string
    leftEntry: PadTextHistoryEntry | null
    leftRevision: RevisionLoadState
    rightEntry: PadTextHistoryEntry | null
    rightRevision: RevisionLoadState
    rightSource: CompareSource
}): PadHistoryMainState {
    if (!input.leftEntry) {
        return {
            kind: 'empty',
            label: 'No older snapshot is selected. Save at least twice or choose a snapshot on the left.',
        }
    }

    if (input.leftRevision.kind === 'loading')
        return { kind: 'loading', label: 'Loading left snapshot…' }
    if (input.leftRevision.kind === 'error')
        return { kind: 'error', label: input.leftRevision.message }
    if (input.leftRevision.kind !== 'ready')
        return { kind: 'empty', label: 'Select a snapshot on the left.' }

    if (input.rightSource.kind === 'current') {
        return {
            kind: 'ready',
            leftContent: input.leftRevision.revision.content,
            rightContent: input.currentContent,
        }
    }

    if (!input.rightEntry)
        return { kind: 'empty', label: 'Choose a newer snapshot on the right.' }
    if (input.rightRevision.kind === 'loading')
        return { kind: 'loading', label: 'Loading right snapshot…' }
    if (input.rightRevision.kind === 'error')
        return { kind: 'error', label: input.rightRevision.message }
    if (input.rightRevision.kind !== 'ready')
        return { kind: 'empty', label: 'Choose a newer snapshot on the right.' }

    return {
        kind: 'ready',
        leftContent: input.leftRevision.revision.content,
        rightContent: input.rightRevision.revision.content,
    }
}

export function readEntry(
    entries: PadTextHistoryEntry[],
    revisionId: number | null,
) {
    if (revisionId === null) return null
    return entries.find((entry) => entry.id === revisionId) ?? null
}

function updateSelection(
    state: HistoryWorkspaceState,
    selection: DiffSelection,
): HistoryWorkspaceState {
    const nextSelection = reconcileSelection(state.entries, selection)

    if (state.kind === 'ready' || state.kind === 'error') {
        return {
            ...state,
            selection: nextSelection,
        }
    }

    return {
        kind: state.kind,
        entries: state.entries,
        selection: nextSelection,
    }
}

function createDefaultSelection(): DiffSelection {
    return {
        leftRevisionId: null,
        rightSource: currentSource,
    }
}

function reconcileSelection(
    entries: PadTextHistoryEntry[],
    current: DiffSelection,
): DiffSelection {
    const leftRevisionId = entries.some(
        (entry) => entry.id === current.leftRevisionId,
    )
        ? current.leftRevisionId
        : chooseDefaultLeftRevisionId(entries)
    const leftEntry = readEntry(entries, leftRevisionId)

    if (!leftEntry) return createDefaultSelection()

    if (current.rightSource.kind === 'revision') {
        const rightEntry = readEntry(entries, current.rightSource.revisionId)
        if (
            rightEntry &&
            rightEntry.revisionNumber > leftEntry.revisionNumber
        ) {
            return {
                leftRevisionId,
                rightSource: current.rightSource,
            }
        }
    }

    return {
        leftRevisionId,
        rightSource: currentSource,
    }
}

function chooseDefaultLeftRevisionId(entries: PadTextHistoryEntry[]) {
    return entries.find((entry) => !entry.isHead)?.id ?? null
}
