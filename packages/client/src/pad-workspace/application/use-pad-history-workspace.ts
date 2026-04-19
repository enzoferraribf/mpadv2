import {
    type PadTextHistoryEntry,
    type PadTextHistoryRevision,
    browserPadTextHistoryQuery,
} from '@/pad-text/infrastructure/browser-pad-text-history'
import { assertNever } from '@mpad/core/assert'
import { PERSIST_DEBOUNCE_MS } from '@mpad/core/pad-limits'
import type { PadPath } from '@mpad/core/pad-path'
import type { PadDocRevisionSummary } from '@mpad/protocol/pad-text-history'
import { useEffect, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'

type CompareSource =
    | { kind: 'current' }
    | { kind: 'revision'; revisionId: number }

type DiffSelection = {
    leftRevisionId: number | null
    rightSource: CompareSource
}

type RevisionLoadState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; revision: PadTextHistoryRevision }

type HistoryWorkspaceState =
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

type HistoryWorkspaceEvent =
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

export type PadHistoryWorkspaceModel = {
    entries: PadTextHistoryEntry[]
    loadingHistory: boolean
    historyError: string | null
    pendingRevertRevisionId: number | null
    selection: DiffSelection
    mainState: PadHistoryMainState
    selectLeftRevision: (revisionId: number) => void
    selectRightCurrent: () => void
    selectRightRevision: (revisionId: number) => void
    revertRevision: (entry: PadTextHistoryEntry) => void
}

const currentSource: CompareSource = { kind: 'current' }

export function usePadHistoryWorkspace(input: {
    path: PadPath
    currentContent: string
    open: boolean
    onRevertToRevision: (input: {
        revisionId: number
        revisionNumber: number
    }) => Promise<PadDocRevisionSummary>
}): PadHistoryWorkspaceModel {
    const [state, dispatch] = useReducer(
        reduceHistoryWorkspaceState,
        undefined,
        createClosedHistoryWorkspaceState,
    )
    const refreshArmedRef = useRef(false)

    useEffect(() => {
        refreshArmedRef.current = false

        if (!input.open) {
            dispatch({ kind: 'closed' })
            return
        }

        const controller = new AbortController()
        void loadHistory(input.path, controller.signal, dispatch)
        return () => controller.abort()
    }, [input.open, input.path])

    useEffect(() => {
        if (!input.open) return

        if (!refreshArmedRef.current) {
            refreshArmedRef.current = true
            return
        }

        const controller = new AbortController()
        const id = window.setTimeout(() => {
            void loadHistory(input.path, controller.signal, dispatch)
        }, PERSIST_DEBOUNCE_MS + 250)

        return () => {
            controller.abort()
            window.clearTimeout(id)
        }
    }, [input.currentContent, input.open, input.path])

    const leftEntry = readEntry(state.entries, state.selection.leftRevisionId)
    const rightEntry =
        state.selection.rightSource.kind === 'revision'
            ? readEntry(state.entries, state.selection.rightSource.revisionId)
            : null
    const leftRevision = usePadTextRevision(
        input.path,
        input.open ? state.selection.leftRevisionId : null,
    )
    const rightRevision = usePadTextRevision(
        input.path,
        input.open && state.selection.rightSource.kind === 'revision'
            ? state.selection.rightSource.revisionId
            : null,
    )

    return {
        entries: state.entries,
        loadingHistory: state.kind === 'loading',
        historyError: state.kind === 'error' ? state.message : null,
        pendingRevertRevisionId:
            state.kind === 'ready' ? state.pendingRevertRevisionId : null,
        selection: state.selection,
        mainState: readMainState({
            currentContent: input.currentContent,
            leftEntry,
            leftRevision,
            rightEntry,
            rightRevision,
            rightSource: state.selection.rightSource,
        }),
        selectLeftRevision(revisionId) {
            dispatch({ kind: 'left-selected', revisionId })
        },
        selectRightCurrent() {
            dispatch({ kind: 'right-current-selected' })
        },
        selectRightRevision(revisionId) {
            dispatch({ kind: 'right-selected', revisionId })
        },
        revertRevision(entry) {
            if (
                state.kind !== 'ready' ||
                state.pendingRevertRevisionId !== null
            )
                return

            dispatch({ kind: 'revert-started', revisionId: entry.id })

            void input
                .onRevertToRevision({
                    revisionId: entry.id,
                    revisionNumber: entry.revisionNumber,
                })
                .then((nextEntry) => {
                    dispatch({ kind: 'revert-succeeded', entry: nextEntry })
                    toast.success(
                        `Reverted to snapshot ${entry.revisionNumber}`,
                    )
                })
                .catch((error: unknown) => {
                    toast.error(
                        error instanceof Error
                            ? error.message
                            : 'Failed to revert snapshot',
                    )
                })
                .finally(() => {
                    dispatch({ kind: 'revert-finished' })
                })
        },
    }
}

function createClosedHistoryWorkspaceState(): HistoryWorkspaceState {
    return {
        kind: 'closed',
        entries: [],
        selection: createDefaultSelection(),
    }
}

function reduceHistoryWorkspaceState(
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

async function loadHistory(
    path: PadPath,
    signal: AbortSignal,
    dispatch: React.ActionDispatch<[HistoryWorkspaceEvent]>,
) {
    dispatch({ kind: 'loading-started' })

    try {
        const entries = await browserPadTextHistoryQuery.listRevisions(
            path,
            signal,
        )
        if (signal.aborted) return
        dispatch({ kind: 'loading-succeeded', entries })
    } catch (error) {
        if (
            !(error instanceof Error) ||
            error.name === 'AbortError' ||
            signal.aborted
        )
            return
        dispatch({ kind: 'loading-failed', message: error.message })
    }
}

function updateSelection(
    state: HistoryWorkspaceState,
    selection: DiffSelection,
): HistoryWorkspaceState {
    const nextSelection = reconcileSelection(state.entries, selection)

    if (state.kind === 'ready') {
        return {
            ...state,
            selection: nextSelection,
        }
    }

    if (state.kind === 'error') {
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

function usePadTextRevision(
    path: PadPath,
    revisionId: number | null,
): RevisionLoadState {
    const [state, setState] = useState<RevisionLoadState>({ kind: 'idle' })

    useEffect(() => {
        if (revisionId === null) {
            setState({ kind: 'idle' })
            return
        }

        let active = true
        const controller = new AbortController()
        setState({ kind: 'loading' })

        void browserPadTextHistoryQuery
            .readRevision(path, revisionId, controller.signal)
            .then((revision) => {
                if (!active) return
                setState({ kind: 'ready', revision })
            })
            .catch((error: Error) => {
                if (error.name === 'AbortError' || !active) return
                setState({ kind: 'error', message: error.message })
            })

        return () => {
            active = false
            controller.abort()
        }
    }, [path, revisionId])

    return state
}

function readMainState(input: {
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

function readEntry(entries: PadTextHistoryEntry[], revisionId: number | null) {
    if (revisionId === null) return null
    return entries.find((entry) => entry.id === revisionId) ?? null
}
