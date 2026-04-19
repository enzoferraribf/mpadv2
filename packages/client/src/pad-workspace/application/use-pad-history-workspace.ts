import type { PadPath } from '@mpad/core/pad-path'
import type { PadDocRevisionSummary } from '@mpad/protocol/pad-text-history'
import { PERSIST_DEBOUNCE_MS } from '@mpad/core/pad-limits'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
    browserPadTextHistoryQuery,
    type PadTextHistoryEntry,
    type PadTextHistoryRevision,
} from '@/pad-text/infrastructure/browser-pad-text-history'

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
    onRevertToRevision: (input: { revisionId: number; revisionNumber: number }) => Promise<PadDocRevisionSummary>
}): PadHistoryWorkspaceModel {
    const [entries, setEntries] = useState<PadTextHistoryEntry[]>([])
    const [historyError, setHistoryError] = useState<string | null>(null)
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [pendingRevertRevisionId, setPendingRevertRevisionId] = useState<number | null>(null)
    const [refreshToken, setRefreshToken] = useState(0)
    const [selection, setSelection] = useState<DiffSelection>({
        leftRevisionId: null,
        rightSource: currentSource,
    })

    useEffect(() => {
        setEntries([])
        setHistoryError(null)
        setLoadingHistory(input.open)
        setPendingRevertRevisionId(null)
        setSelection({
            leftRevisionId: null,
            rightSource: currentSource,
        })
        setRefreshToken((value) => value + 1)
    }, [input.open, input.path])

    useEffect(() => {
        if (!input.open) return

        const id = window.setTimeout(() => setRefreshToken((value) => value + 1), PERSIST_DEBOUNCE_MS + 250)
        return () => window.clearTimeout(id)
    }, [input.currentContent, input.open, input.path])

    useEffect(() => {
        if (!input.open) {
            setLoadingHistory(false)
            return
        }

        let active = true
        const controller = new AbortController()
        setLoadingHistory(true)

        void browserPadTextHistoryQuery.listRevisions(input.path, controller.signal)
            .then((nextEntries) => {
                if (!active) return
                setEntries(nextEntries)
                setHistoryError(null)
                setSelection((current) => reconcileSelection(nextEntries, current))
            })
            .catch((error: Error) => {
                if (error.name === 'AbortError' || !active) return
                setEntries([])
                setHistoryError(error.message)
                setSelection({
                    leftRevisionId: null,
                    rightSource: currentSource,
                })
            })
            .finally(() => {
                if (!active) return
                setLoadingHistory(false)
            })

        return () => {
            active = false
            controller.abort()
        }
    }, [input.open, input.path, refreshToken])

    const leftEntry = readEntry(entries, selection.leftRevisionId)
    const rightEntry = selection.rightSource.kind === 'revision'
        ? readEntry(entries, selection.rightSource.revisionId)
        : null
    const leftRevision = usePadTextRevision(input.path, input.open ? selection.leftRevisionId : null)
    const rightRevision = usePadTextRevision(
        input.path,
        input.open && selection.rightSource.kind === 'revision' ? selection.rightSource.revisionId : null,
    )

    return {
        entries,
        loadingHistory,
        historyError,
        pendingRevertRevisionId,
        selection,
        mainState: readMainState({
            currentContent: input.currentContent,
            leftEntry,
            leftRevision,
            rightEntry,
            rightRevision,
            rightSource: selection.rightSource,
        }),
        selectLeftRevision(revisionId) {
            setSelection((current) => reconcileSelection(entries, {
                leftRevisionId: revisionId,
                rightSource: current.rightSource,
            }))
        },
        selectRightCurrent() {
            setSelection((current) => reconcileSelection(entries, {
                leftRevisionId: current.leftRevisionId,
                rightSource: currentSource,
            }))
        },
        selectRightRevision(revisionId) {
            setSelection((current) => reconcileSelection(entries, {
                leftRevisionId: current.leftRevisionId,
                rightSource: { kind: 'revision', revisionId },
            }))
        },
        revertRevision(entry) {
            if (!input.open || pendingRevertRevisionId !== null) return

            setPendingRevertRevisionId(entry.id)

            void input.onRevertToRevision({
                revisionId: entry.id,
                revisionNumber: entry.revisionNumber,
            })
                .then((nextEntry) => {
                    const nextEntries = [
                        nextEntry,
                        ...entries.map((value) => ({
                            ...value,
                            isHead: false,
                        })),
                    ]
                    setEntries(nextEntries)
                    setSelection((current) => reconcileSelection(nextEntries, current))
                    toast.success(`Reverted to snapshot ${entry.revisionNumber}`)
                    setRefreshToken((value) => value + 1)
                })
                .catch((error: unknown) => {
                    toast.error(error instanceof Error ? error.message : 'Failed to revert snapshot')
                })
                .finally(() => {
                    setPendingRevertRevisionId(null)
                })
        },
    }
}

function usePadTextRevision(path: PadPath, revisionId: number | null): RevisionLoadState {
    const [state, setState] = useState<RevisionLoadState>({ kind: 'idle' })

    useEffect(() => {
        if (revisionId === null) {
            setState({ kind: 'idle' })
            return
        }

        let active = true
        const controller = new AbortController()
        setState({ kind: 'loading' })

        void browserPadTextHistoryQuery.readRevision(path, revisionId, controller.signal)
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

    if (input.leftRevision.kind === 'loading') return { kind: 'loading', label: 'Loading left snapshot…' }
    if (input.leftRevision.kind === 'error') return { kind: 'error', label: input.leftRevision.message }
    if (input.leftRevision.kind !== 'ready') return { kind: 'empty', label: 'Select a snapshot on the left.' }

    if (input.rightSource.kind === 'current') {
        return {
            kind: 'ready',
            leftContent: input.leftRevision.revision.content,
            rightContent: input.currentContent,
        }
    }

    if (!input.rightEntry) return { kind: 'empty', label: 'Choose a newer snapshot on the right.' }
    if (input.rightRevision.kind === 'loading') return { kind: 'loading', label: 'Loading right snapshot…' }
    if (input.rightRevision.kind === 'error') return { kind: 'error', label: input.rightRevision.message }
    if (input.rightRevision.kind !== 'ready') return { kind: 'empty', label: 'Choose a newer snapshot on the right.' }

    return {
        kind: 'ready',
        leftContent: input.leftRevision.revision.content,
        rightContent: input.rightRevision.revision.content,
    }
}

function reconcileSelection(entries: PadTextHistoryEntry[], current: DiffSelection): DiffSelection {
    const leftRevisionId = entries.some((entry) => entry.id === current.leftRevisionId)
        ? current.leftRevisionId
        : chooseDefaultLeftRevisionId(entries)
    const leftEntry = readEntry(entries, leftRevisionId)

    if (!leftEntry) {
        return {
            leftRevisionId: null,
            rightSource: currentSource,
        }
    }

    if (current.rightSource.kind === 'revision') {
        const rightEntry = readEntry(entries, current.rightSource.revisionId)
        if (rightEntry && rightEntry.revisionNumber > leftEntry.revisionNumber) {
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
