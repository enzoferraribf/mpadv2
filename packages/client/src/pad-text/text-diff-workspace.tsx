import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import type { PadHistoryWorkspaceModel } from '@/pad-workspace/application/use-pad-history-workspace'
import { LoaderCircle, RotateCcw } from 'lucide-react'
import { TextDiffMergeView } from './text-diff-merge-view'

export function TextDiffWorkspace(input: {
    direction: 'horizontal' | 'vertical'
    model: PadHistoryWorkspaceModel
}) {
    const leftRevisionId = input.model.selection.leftRevisionId
    const rightRevisionId =
        input.model.selection.rightSource.kind === 'revision'
            ? input.model.selection.rightSource.revisionId
            : null

    return (
        <section
            className='workspace-shell min-h-0'
            data-testid='workspace-shell'
        >
            <ResizablePanelGroup
                autoSaveId='pad-diff-split'
                direction={input.direction}
                className='h-full min-h-0'
            >
                <ResizablePanel defaultSize={24} minSize={18}>
                    <div className='diff-history-pane'>
                        <div className='diff-history-header'>Snapshots</div>
                        {input.model.loadingHistory ? (
                            <DiffEmpty label='Loading snapshots…' />
                        ) : null}
                        {!input.model.loadingHistory &&
                        input.model.historyError ? (
                            <DiffEmpty label={input.model.historyError} />
                        ) : null}
                        {!input.model.loadingHistory &&
                        !input.model.historyError &&
                        input.model.entries.length === 0 ? (
                            <DiffEmpty label='No snapshots yet. Wait for the next save.' />
                        ) : null}
                        {!input.model.loadingHistory &&
                        !input.model.historyError &&
                        input.model.entries.length > 0 ? (
                            <div className='diff-history-list'>
                                <div
                                    className={`diff-history-item diff-history-item-current${rightRevisionId === null ? ' active-right' : ''}`}
                                >
                                    <div className='diff-history-item-copy'>
                                        <span className='diff-history-item-number'>
                                            Current
                                        </span>
                                        <span className='diff-history-item-time'>
                                            Live text
                                        </span>
                                    </div>
                                    <div className='diff-history-item-actions'>
                                        <button
                                            aria-label='Select current text as right'
                                            aria-pressed={
                                                rightRevisionId === null
                                            }
                                            className={`diff-history-toggle${rightRevisionId === null ? ' active' : ''}`}
                                            onClick={
                                                input.model.selectRightCurrent
                                            }
                                            type='button'
                                        >
                                            Right
                                        </button>
                                    </div>
                                </div>
                                {input.model.entries.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className={readHistoryItemClassName(
                                            entry.id,
                                            leftRevisionId,
                                            rightRevisionId,
                                        )}
                                        data-testid='diff-history-item'
                                    >
                                        <div className='diff-history-item-copy'>
                                            <span className='diff-history-item-number'>
                                                Snapshot {entry.revisionNumber}
                                            </span>
                                            <span className='diff-history-item-time'>
                                                {formatRevisionTime(
                                                    entry.createdAt,
                                                )}
                                            </span>
                                            {entry.revertedFromRevisionNumber !==
                                            null ? (
                                                <span className='diff-history-item-note'>
                                                    Revert to Snapshot{' '}
                                                    {
                                                        entry.revertedFromRevisionNumber
                                                    }
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className='diff-history-item-actions'>
                                            <button
                                                aria-label={`Select snapshot ${entry.revisionNumber} as left`}
                                                aria-pressed={
                                                    entry.id === leftRevisionId
                                                }
                                                className={`diff-history-toggle${entry.id === leftRevisionId ? ' active' : ''}`}
                                                disabled={
                                                    !canSelectLeft(
                                                        input.model.entries,
                                                        entry.id,
                                                        input.model.selection
                                                            .rightSource,
                                                    )
                                                }
                                                onClick={() =>
                                                    input.model.selectLeftRevision(
                                                        entry.id,
                                                    )
                                                }
                                                type='button'
                                            >
                                                Left
                                            </button>
                                            <button
                                                aria-label={`Select snapshot ${entry.revisionNumber} as right`}
                                                aria-pressed={
                                                    rightRevisionId === entry.id
                                                }
                                                className={`diff-history-toggle${rightRevisionId === entry.id ? ' active' : ''}`}
                                                disabled={
                                                    !canSelectRight(
                                                        input.model.entries,
                                                        leftRevisionId,
                                                        entry.id,
                                                    )
                                                }
                                                onClick={() =>
                                                    input.model.selectRightRevision(
                                                        entry.id,
                                                    )
                                                }
                                                type='button'
                                            >
                                                Right
                                            </button>
                                            <button
                                                aria-label={`Revert to snapshot ${entry.revisionNumber}`}
                                                aria-busy={
                                                    input.model
                                                        .pendingRevertRevisionId ===
                                                    entry.id
                                                }
                                                className='diff-history-toggle diff-history-revert diff-history-toggle-icon-only'
                                                disabled={
                                                    input.model
                                                        .pendingRevertRevisionId !==
                                                    null
                                                }
                                                onClick={() =>
                                                    input.model.revertRevision(
                                                        entry,
                                                    )
                                                }
                                                type='button'
                                            >
                                                {input.model
                                                    .pendingRevertRevisionId ===
                                                entry.id ? (
                                                    <LoaderCircle
                                                        aria-hidden='true'
                                                        className='diff-history-toggle-icon animate-spin'
                                                    />
                                                ) : (
                                                    <RotateCcw
                                                        aria-hidden='true'
                                                        className='diff-history-toggle-icon'
                                                    />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </ResizablePanel>
                <ResizableHandle
                    className='mx-0 bg-[--stone-border]'
                    withHandle
                />
                <ResizablePanel defaultSize={76} minSize={40}>
                    <div
                        className='diff-main-pane'
                        data-testid='text-diff-workspace'
                    >
                        <DiffMainView state={input.model.mainState} />
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </section>
    )
}

function DiffMainView(input: { state: PadHistoryWorkspaceModel['mainState'] }) {
    if (input.state.kind === 'loading')
        return <DiffEmpty label={input.state.label} />
    if (input.state.kind === 'error')
        return <DiffEmpty label={input.state.label} />
    if (input.state.kind === 'empty')
        return <DiffEmpty label={input.state.label} />

    return (
        <TextDiffMergeView
            leftContent={input.state.leftContent}
            rightContent={input.state.rightContent}
        />
    )
}

function DiffEmpty(input: { label: string }) {
    return <div className='diff-empty'>{input.label}</div>
}

function canSelectLeft(
    entries: PadHistoryWorkspaceModel['entries'],
    revisionId: number,
    rightSource: PadHistoryWorkspaceModel['selection']['rightSource'],
) {
    if (rightSource.kind === 'current') return true

    const entry = readEntry(entries, revisionId)
    const rightEntry = readEntry(entries, rightSource.revisionId)
    if (!entry || !rightEntry) return false
    return entry.revisionNumber < rightEntry.revisionNumber
}

function canSelectRight(
    entries: PadHistoryWorkspaceModel['entries'],
    leftRevisionId: number | null,
    revisionId: number,
) {
    const leftEntry = readEntry(entries, leftRevisionId)
    const rightEntry = readEntry(entries, revisionId)
    if (!leftEntry || !rightEntry) return false
    return rightEntry.revisionNumber > leftEntry.revisionNumber
}

function readEntry(
    entries: PadHistoryWorkspaceModel['entries'],
    revisionId: number | null,
) {
    if (revisionId === null) return null
    return entries.find((entry) => entry.id === revisionId) ?? null
}

function readHistoryItemClassName(
    entryId: number,
    leftRevisionId: number | null,
    rightRevisionId: number | null,
) {
    const classes = ['diff-history-item']
    if (entryId === leftRevisionId) classes.push('active-left')
    if (entryId === rightRevisionId) classes.push('active-right')
    return classes.join(' ')
}

function formatRevisionTime(value: string) {
    if (import.meta.env.VITE_E2E === '1') return '03/29/26, 6:18 PM'
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value))
}
