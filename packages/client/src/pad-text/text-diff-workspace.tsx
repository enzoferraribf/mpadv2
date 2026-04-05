import { PERSIST_DEBOUNCE_MS, type PadPath } from '@mmpad/shared'
import { RotateCcw } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchPadTextHistory, fetchPadTextRevision, type PadTextHistoryEntry, type PadTextHistoryRevision } from '@/pad-session/api'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

const LazyTextDiffMergeView = lazy(() => import('./text-diff-merge-view').then((mod) => ({ default: mod.TextDiffMergeView })))

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

type DiffReadyState = {
    kind: 'ready'
    leftContent: string
    leftLabel: string
    rightContent: string
    rightLabel: string
}

type DiffMainState =
    | { kind: 'loading'; label: string }
    | { kind: 'empty'; label: string }
    | { kind: 'error'; label: string }
    | DiffReadyState

const currentSource: CompareSource = { kind: 'current' }

export function TextDiffWorkspace(input: {
    currentContent: string
    direction: 'horizontal' | 'vertical'
    onRevertToRevision: (input: { revisionId: number; revisionNumber: number }) => Promise<PadTextHistoryEntry>
    path: PadPath
}) {
    const [entries, setEntries] = useState<PadTextHistoryEntry[]>([])
    const [historyError, setHistoryError] = useState<string | null>(null)
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [pendingRevertRevisionId, setPendingRevertRevisionId] = useState<number | null>(null)
    const [refreshToken, setRefreshToken] = useState(0)
    const [selection, setSelection] = useState<DiffSelection>({
        leftRevisionId: null,
        rightSource: currentSource,
    })

    useEffect(() => {
        setEntries([])
        setHistoryError(null)
        setLoadingHistory(true)
        setPendingRevertRevisionId(null)
        setSelection({
            leftRevisionId: null,
            rightSource: currentSource,
        })
        setRefreshToken((value) => value + 1)
    }, [input.path])

    useEffect(() => {
        const id = window.setTimeout(() => setRefreshToken((value) => value + 1), PERSIST_DEBOUNCE_MS + 250)
        return () => window.clearTimeout(id)
    }, [input.currentContent, input.path])

    useEffect(() => {
        let active = true
        const controller = new AbortController()
        setLoadingHistory(true)

        void fetchPadTextHistory(input.path, controller.signal)
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
    }, [input.path, refreshToken])

    const leftEntry = readEntry(entries, selection.leftRevisionId)
    const rightEntry = selection.rightSource.kind === 'revision'
        ? readEntry(entries, selection.rightSource.revisionId)
        : null
    const leftRevision = usePadTextRevision(input.path, selection.leftRevisionId)
    const rightRevision = usePadTextRevision(
        input.path,
        selection.rightSource.kind === 'revision' ? selection.rightSource.revisionId : null,
    )
    const mainState = readMainState({
        currentContent: input.currentContent,
        leftEntry,
        leftRevision,
        rightEntry,
        rightRevision,
        rightSource: selection.rightSource,
    })
    const handleRevert = (entry: PadTextHistoryEntry) => {
        if (pendingRevertRevisionId !== null) return

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
                setSelection((currentSelection) => reconcileSelection(nextEntries, currentSelection))
                toast.success(`Reverted to snapshot ${entry.revisionNumber}`)
                setRefreshToken((value) => value + 1)
            })
            .catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : 'Failed to revert snapshot')
            })
            .finally(() => {
                setPendingRevertRevisionId(null)
            })
    }

    return (
        <section className="workspace-shell min-h-0" data-testid="workspace-shell">
            <ResizablePanelGroup direction={input.direction} className="h-full min-h-0">
                <ResizablePanel defaultSize={24} minSize={18}>
                    <div className="diff-history-pane">
                        <div className="diff-history-header">Snapshots</div>
                        {loadingHistory ? <DiffEmpty label="Loading snapshots…" /> : null}
                        {!loadingHistory && historyError ? <DiffEmpty label={historyError} /> : null}
                        {!loadingHistory && !historyError && entries.length === 0 ? (
                            <DiffEmpty label="No snapshots yet. Wait for the next save." />
                        ) : null}
                        {!loadingHistory && !historyError && entries.length > 0 ? (
                            <div className="diff-history-list">
                                <div className={`diff-history-item diff-history-item-current${selection.rightSource.kind === 'current' ? ' active-right' : ''}`}>
                                    <div className="diff-history-item-copy">
                                        <span className="diff-history-item-number">Current</span>
                                        <span className="diff-history-item-time">Live text</span>
                                    </div>
                                    <div className="diff-history-item-actions">
                                        <button
                                            aria-label="Select current text as right"
                                            aria-pressed={selection.rightSource.kind === 'current'}
                                            className={`diff-history-toggle${selection.rightSource.kind === 'current' ? ' active' : ''}`}
                                            onClick={() => setSelection((current) => reconcileSelection(entries, {
                                                leftRevisionId: current.leftRevisionId,
                                                rightSource: currentSource,
                                            }))}
                                            type="button"
                                        >
                                            Right
                                        </button>
                                    </div>
                                </div>
                                {entries.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className={readHistoryItemClassName(entry, selection)}
                                        data-testid="diff-history-item"
                                    >
                                        <div className="diff-history-item-copy">
                                            <span className="diff-history-item-number">Snapshot {entry.revisionNumber}</span>
                                            <span className="diff-history-item-time">{formatRevisionTime(entry.createdAt)}</span>
                                            {entry.revertedFromRevisionNumber !== null ? (
                                                <span className="diff-history-item-note">Revert to Snapshot {entry.revertedFromRevisionNumber}</span>
                                            ) : null}
                                        </div>
                                        <div className="diff-history-item-actions">
                                            <button
                                                aria-label={`Select snapshot ${entry.revisionNumber} as left`}
                                                aria-pressed={entry.id === selection.leftRevisionId}
                                                className={`diff-history-toggle${entry.id === selection.leftRevisionId ? ' active' : ''}`}
                                                disabled={!canSelectLeft(entries, entry, selection.rightSource)}
                                                onClick={() => setSelection((current) =>
                                                    reconcileSelection(entries, {
                                                        leftRevisionId: entry.id,
                                                        rightSource: current.rightSource,
                                                    }),
                                                )}
                                                type="button"
                                            >
                                                Left
                                            </button>
                                            <button
                                                aria-label={`Select snapshot ${entry.revisionNumber} as right`}
                                                aria-pressed={selection.rightSource.kind === 'revision' && selection.rightSource.revisionId === entry.id}
                                                className={`diff-history-toggle${selection.rightSource.kind === 'revision' && selection.rightSource.revisionId === entry.id ? ' active' : ''}`}
                                                disabled={!canSelectRight(leftEntry, entry)}
                                                onClick={() => setSelection((current) => reconcileSelection(entries, {
                                                    leftRevisionId: current.leftRevisionId,
                                                    rightSource: { kind: 'revision', revisionId: entry.id },
                                                }))}
                                                type="button"
                                            >
                                                Right
                                            </button>
                                            <button
                                                aria-label={`Revert to snapshot ${entry.revisionNumber}`}
                                                className="diff-history-toggle diff-history-revert"
                                                disabled={pendingRevertRevisionId !== null}
                                                onClick={() => handleRevert(entry)}
                                                type="button"
                                            >
                                                <RotateCcw aria-hidden="true" className="diff-history-toggle-icon" />
                                                {pendingRevertRevisionId === entry.id ? 'Reverting…' : 'Revert To'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </ResizablePanel>
                <ResizableHandle className="mx-0 bg-[--stone-border]" />
                <ResizablePanel defaultSize={76} minSize={40}>
                    <div className="diff-main-pane" data-testid="text-diff-workspace">
                        <DiffMainView state={mainState} />
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </section>
    )
}

function DiffMainView(input: { state: DiffMainState }) {
    if (input.state.kind === 'loading') return <DiffEmpty label={input.state.label} />
    if (input.state.kind === 'error') return <DiffEmpty label={input.state.label} />
    if (input.state.kind === 'empty') return <DiffEmpty label={input.state.label} />

    return (
        <Suspense fallback={<DiffEmpty label="Loading diff…" />}>
            <LazyTextDiffMergeView
                leftContent={input.state.leftContent}
                rightContent={input.state.rightContent}
            />
        </Suspense>
    )
}

function DiffEmpty(input: { label: string }) {
    return <div className="diff-empty">{input.label}</div>
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

        void fetchPadTextRevision(path, revisionId, controller.signal)
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
}): DiffMainState {
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
            leftLabel: `Snapshot ${input.leftRevision.revision.revisionNumber}`,
            rightContent: input.currentContent,
            rightLabel: 'Current',
        }
    }

    if (!input.rightEntry) return { kind: 'empty', label: 'Choose a newer snapshot on the right.' }
    if (input.rightRevision.kind === 'loading') return { kind: 'loading', label: 'Loading right snapshot…' }
    if (input.rightRevision.kind === 'error') return { kind: 'error', label: input.rightRevision.message }
    if (input.rightRevision.kind !== 'ready') return { kind: 'empty', label: 'Choose a newer snapshot on the right.' }

    return {
        kind: 'ready',
        leftContent: input.leftRevision.revision.content,
        leftLabel: `Snapshot ${input.leftRevision.revision.revisionNumber}`,
        rightContent: input.rightRevision.revision.content,
        rightLabel: `Snapshot ${input.rightRevision.revision.revisionNumber}`,
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

function canSelectLeft(entries: PadTextHistoryEntry[], entry: PadTextHistoryEntry, rightSource: CompareSource) {
    if (rightSource.kind === 'current') return true
    const rightEntry = readEntry(entries, rightSource.revisionId)
    if (!rightEntry) return false
    return entry.revisionNumber < rightEntry.revisionNumber
}

function canSelectRight(leftEntry: PadTextHistoryEntry | null, entry: PadTextHistoryEntry) {
    if (!leftEntry) return false
    return entry.revisionNumber > leftEntry.revisionNumber
}

function readHistoryItemClassName(entry: PadTextHistoryEntry, selection: DiffSelection) {
    const classes = ['diff-history-item']
    if (entry.id === selection.leftRevisionId) classes.push('active-left')
    if (selection.rightSource.kind === 'revision' && selection.rightSource.revisionId === entry.id) classes.push('active-right')
    return classes.join(' ')
}

function formatRevisionTime(value: string) {
    if (import.meta.env.VITE_E2E === '1') return '03/29/26, 6:18 PM'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
