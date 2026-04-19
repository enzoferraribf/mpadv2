import {
    type PadTextHistoryEntry,
    browserPadTextHistoryQuery,
} from '@/pad-text/infrastructure/browser-pad-text-history'
import {
    type DiffSelection,
    type HistoryWorkspaceEvent,
    type PadHistoryMainState,
    type RevisionLoadState,
    createClosedHistoryWorkspaceState,
    readEntry,
    readMainState,
    reduceHistoryWorkspaceState,
} from '@/pad-workspace/application/pad-history-state'
import { PERSIST_DEBOUNCE_MS } from '@mpad/core/pad-limits'
import type { PadPath } from '@mpad/core/pad-path'
import type { PadDocRevisionSummary } from '@mpad/protocol/pad-text-history'
import {
    type ActionDispatch,
    useEffect,
    useReducer,
    useRef,
    useState,
} from 'react'
import { toast } from 'sonner'

export type { PadHistoryMainState } from '@/pad-workspace/application/pad-history-state'

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

async function loadHistory(
    path: PadPath,
    signal: AbortSignal,
    dispatch: ActionDispatch<[HistoryWorkspaceEvent]>,
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
