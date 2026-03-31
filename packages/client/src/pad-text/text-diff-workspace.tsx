import { PERSIST_DEBOUNCE_MS, type PadPath } from '@mmpad/shared'
import { diffLines, diffWordsWithSpace } from 'diff'
import { useEffect, useMemo, useState } from 'react'
import { fetchPadTextHistory, fetchPadTextRevision, type PadTextHistoryEntry, type PadTextHistoryRevision } from '@/pad-session/api'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

type DiffCell = {
    kind: 'added' | 'context' | 'empty' | 'removed'
    lineNumber: number | null
    parts: DiffPart[]
}

type DiffPart = {
    kind: 'added' | 'context' | 'removed'
    text: string
}

type DiffRow = {
    left: DiffCell
    right: DiffCell
}

export function TextDiffWorkspace(input: {
    currentContent: string
    direction: 'horizontal' | 'vertical'
    path: PadPath
}) {
    const [entries, setEntries] = useState<PadTextHistoryEntry[]>([])
    const [historyError, setHistoryError] = useState<string | null>(null)
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [loadingRevision, setLoadingRevision] = useState(false)
    const [refreshToken, setRefreshToken] = useState(0)
    const [selectedRevision, setSelectedRevision] = useState<PadTextHistoryRevision | null>(null)
    const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null)
    const [revisionError, setRevisionError] = useState<string | null>(null)

    useEffect(() => {
        setEntries([])
        setSelectedRevision(null)
        setSelectedRevisionId(null)
        setHistoryError(null)
        setRevisionError(null)
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
                setSelectedRevisionId((current) => chooseRevisionId(nextEntries, current))
            })
            .catch((error: Error) => {
                if (error.name === 'AbortError' || !active) return
                setHistoryError(error.message)
                setEntries([])
                setSelectedRevisionId(null)
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

    useEffect(() => {
        if (selectedRevisionId === null) {
            setSelectedRevision(null)
            setRevisionError(null)
            setLoadingRevision(false)
            return
        }

        let active = true
        const controller = new AbortController()
        setLoadingRevision(true)

        void fetchPadTextRevision(input.path, selectedRevisionId, controller.signal)
            .then((revision) => {
                if (!active) return
                setSelectedRevision(revision)
                setRevisionError(null)
            })
            .catch((error: Error) => {
                if (error.name === 'AbortError' || !active) return
                setRevisionError(error.message)
                setSelectedRevision(null)
            })
            .finally(() => {
                if (!active) return
                setLoadingRevision(false)
            })

        return () => {
            active = false
            controller.abort()
        }
    }, [input.path, selectedRevisionId])

    const rows = useMemo(
        () => selectedRevision ? buildDiffRows(selectedRevision.content, input.currentContent) : [],
        [input.currentContent, selectedRevision],
    )

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
                                {entries.map((entry) => (
                                    <button
                                        key={entry.id}
                                        className={`diff-history-item${entry.id === selectedRevisionId ? ' active' : ''}`}
                                        data-testid="diff-history-item"
                                        onClick={() => setSelectedRevisionId(entry.id)}
                                    >
                                        <span className="diff-history-item-number">Snapshot {entry.revisionNumber}</span>
                                        <span className="diff-history-item-time">{formatRevisionTime(entry.createdAt)}</span>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </ResizablePanel>
                <ResizableHandle className="mx-0 bg-[--stone-border]" />
                <ResizablePanel defaultSize={76} minSize={40}>
                    <div className="diff-main-pane" data-testid="text-diff-workspace">
                        {loadingRevision ? <DiffEmpty label="Loading diff…" /> : null}
                        {!loadingRevision && revisionError ? <DiffEmpty label={revisionError} /> : null}
                        {!loadingRevision && !revisionError && !selectedRevision ? (
                            <DiffEmpty label="Select a snapshot to compare it with the current text." />
                        ) : null}
                        {!loadingRevision && !revisionError && selectedRevision ? (
                            <DiffTable
                                rows={rows}
                                leftLabel={`Snapshot ${selectedRevision.revisionNumber}`}
                                rightLabel="Current"
                            />
                        ) : null}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </section>
    )
}

function DiffTable(input: { rows: DiffRow[]; leftLabel: string; rightLabel: string }) {
    return (
        <div className="diff-table-scroll">
            <div className="diff-table">
                <div className="diff-table-header">
                    <div className="diff-table-title">{input.leftLabel}</div>
                    <div className="diff-table-title">{input.rightLabel}</div>
                </div>
                {input.rows.length === 0 ? <DiffEmpty label="No visible changes." compact /> : null}
                {input.rows.map((row, index) => (
                    <div key={index} className="diff-row">
                        <DiffCellView cell={row.left} />
                        <DiffCellView cell={row.right} />
                    </div>
                ))}
            </div>
        </div>
    )
}

function DiffCellView(input: { cell: DiffCell }) {
    return (
        <div className={`diff-cell diff-cell-${input.cell.kind}`}>
            <span className="diff-line-number">{input.cell.lineNumber ?? ''}</span>
            <span className="diff-line-text">
                {input.cell.parts.length === 0 ? '\u00A0' : input.cell.parts.map((part, index) => (
                    <span key={index} className={`diff-part diff-part-${part.kind}`}>
                        {part.text || '\u00A0'}
                    </span>
                ))}
            </span>
        </div>
    )
}

function DiffEmpty(input: { compact?: boolean; label: string }) {
    return <div className={`diff-empty${input.compact ? ' compact' : ''}`}>{input.label}</div>
}

function buildDiffRows(previous: string, current: string) {
    const rows: DiffRow[] = []
    const parts = diffLines(previous, current)
    let leftLine = 1
    let rightLine = 1

    for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index]!

        if (part.removed && parts[index + 1]?.added) {
            const removedLines = splitLines(part.value)
            const addedLines = splitLines(parts[index + 1]!.value)
            const lineCount = Math.max(removedLines.length, addedLines.length)

            for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
                const removedLine = removedLines[lineIndex]
                const addedLine = addedLines[lineIndex]

                if (removedLine !== undefined && addedLine !== undefined) {
                    const inline = buildInlineParts(removedLine, addedLine)
                    rows.push({
                        left: {
                            kind: 'removed',
                            lineNumber: leftLine,
                            parts: inline.left,
                        },
                        right: {
                            kind: 'added',
                            lineNumber: rightLine,
                            parts: inline.right,
                        },
                    })
                    leftLine += 1
                    rightLine += 1
                    continue
                }

                if (removedLine !== undefined) {
                    rows.push({
                        left: {
                            kind: 'removed',
                            lineNumber: leftLine,
                            parts: [{ kind: 'removed', text: removedLine }],
                        },
                        right: emptyCell(),
                    })
                    leftLine += 1
                    continue
                }

                rows.push({
                    left: emptyCell(),
                    right: {
                        kind: 'added',
                        lineNumber: rightLine,
                        parts: [{ kind: 'added', text: addedLine ?? '' }],
                    },
                })
                rightLine += 1
            }

            index += 1
            continue
        }

        if (part.removed) {
            for (const line of splitLines(part.value)) {
                rows.push({
                    left: {
                        kind: 'removed',
                        lineNumber: leftLine,
                        parts: [{ kind: 'removed', text: line }],
                    },
                    right: emptyCell(),
                })
                leftLine += 1
            }
            continue
        }

        if (part.added) {
            for (const line of splitLines(part.value)) {
                rows.push({
                    left: emptyCell(),
                    right: {
                        kind: 'added',
                        lineNumber: rightLine,
                        parts: [{ kind: 'added', text: line }],
                    },
                })
                rightLine += 1
            }
            continue
        }

        for (const line of splitLines(part.value)) {
            rows.push({
                left: {
                    kind: 'context',
                    lineNumber: leftLine,
                    parts: [{ kind: 'context', text: line }],
                },
                right: {
                    kind: 'context',
                    lineNumber: rightLine,
                    parts: [{ kind: 'context', text: line }],
                },
            })
            leftLine += 1
            rightLine += 1
        }
    }

    return rows
}

function buildInlineParts(left: string, right: string) {
    const leftParts: DiffPart[] = []
    const rightParts: DiffPart[] = []

    for (const part of diffWordsWithSpace(left, right)) {
        if (part.added) {
            rightParts.push({ kind: 'added', text: part.value })
            continue
        }

        if (part.removed) {
            leftParts.push({ kind: 'removed', text: part.value })
            continue
        }

        leftParts.push({ kind: 'context', text: part.value })
        rightParts.push({ kind: 'context', text: part.value })
    }

    return {
        left: leftParts,
        right: rightParts,
    }
}

function splitLines(value: string) {
    if (!value) return []
    const lines = value.split('\n')
    if (value.endsWith('\n')) lines.pop()
    return lines
}

function emptyCell(): DiffCell {
    return {
        kind: 'empty',
        lineNumber: null,
        parts: [],
    }
}

function chooseRevisionId(entries: PadTextHistoryEntry[], current: number | null) {
    if (current !== null && entries.some((entry) => entry.id === current)) return current
    return entries.find((entry) => !entry.isHead)?.id ?? entries[0]?.id ?? null
}

function formatRevisionTime(value: string) {
    if (import.meta.env.VITE_E2E === '1') return '03/29/26, 6:18 PM'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
