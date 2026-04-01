import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { TextPadComments } from '@/pad-text/application/use-text-pad'
import type { TextCommentResult } from '@/pad-text/infrastructure/text-comment-store'
import {
    buildCommentMarkers,
    readOverlayThreadId,
    type TextCommentRangeRect,
} from '@/pad-text/domain/comment-overlay'
import { TextCommentsPane } from './text-comments-pane'
import type { CursorPosition, TextEditorHandle, TextEditorSelection } from '@/pad-text/infrastructure/text-editor'

export function MarkdownEditorPane(input: {
    comments: TextPadComments
    editor: TextEditorHandle
    onCloseCommentOverlay: () => void
    onCommentCreateThread: (body: string) => TextCommentResult<{ threadId: string }>
    onCommentDeleteMessage: (input: { threadId: string; messageId: string }) => TextCommentResult
    onCommentDeleteThread: (threadId: string) => TextCommentResult
    onCommentEditMessage: (input: { threadId: string; messageId: string; body: string }) => TextCommentResult
    onCommentOpenThread: (threadId: string | null) => void
    onCommentReopen: (threadId: string) => TextCommentResult
    onCommentReply: (input: { threadId: string; body: string }) => TextCommentResult<{ messageId: string }>
    onCommentResolve: (threadId: string) => TextCommentResult
    onCommentStartDraft: () => void
    onCursorChange?: (cursor: CursorPosition) => void
    onSelectionChange: (selection: TextEditorSelection | null) => void
}) {
    const rootRef = useRef<HTMLDivElement | null>(null)
    const [layoutTick, setLayoutTick] = useState(0)
    const onCursorChange = useEffectEvent((cursor: CursorPosition) => {
        if (!input.onCursorChange) return
        input.onCursorChange(cursor)
    })
    const onSelectionChange = useEffectEvent((selection: TextEditorSelection | null) => {
        input.onSelectionChange(selection)
    })
    const onCommentClick = useEffectEvent((threadId: string) => {
        input.onCommentOpenThread(threadId)
    })
    const onLayoutChange = useEffectEvent(() => {
        setLayoutTick((value) => value + 1)
    })

    useEffect(() => {
        const parent = rootRef.current
        if (!parent) return
        return input.editor.mount({
            root: parent,
            onCommentClick,
            onCursorChange,
            onLayoutChange,
            onSelectionChange,
        })
    }, [input.editor])

    useEffect(() => {
        const onResize = () => setLayoutTick((value) => value + 1)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const activeThreadId = readOverlayThreadId(input.comments.overlay)

    useEffect(() => {
        input.editor.setCommentHighlights(input.comments.highlights)
    }, [input.comments.highlights, input.editor])

    useEffect(() => {
        input.editor.setActiveCommentThread(activeThreadId)
    }, [activeThreadId, input.editor])

    const markers = useMemo(() => {
        const anchors = new Map<string, TextCommentRangeRect | null>()
        for (const thread of input.comments.threads) {
            if (thread.anchor.detached) continue
            anchors.set(thread.id, input.editor.measureCommentRange(thread.anchor.from, thread.anchor.to))
        }

        return buildCommentMarkers({
            activeThreadId,
            anchors,
            threads: input.comments.threads,
        })
    }, [activeThreadId, input.comments.threads, input.editor, layoutTick])

    const overlayTop = useMemo(() => {
        if (input.comments.overlay.kind === 'draft') {
            const anchor = input.editor.measureCommentRange(
                input.comments.overlay.selection.from,
                input.comments.overlay.selection.to,
            )
            if (anchor) return anchor.top
            return input.comments.currentSelection?.rect.top ?? 16
        }

        if (input.comments.overlay.kind !== 'thread') return null
        const { threadId } = input.comments.overlay
        return markers.find((marker) => marker.threadId === threadId)?.top ?? 16
    }, [input.comments.currentSelection, input.comments.overlay, input.editor, markers, layoutTick])

    const containerHeight = rootRef.current?.clientHeight ?? 0

    return (
        <div ref={rootRef} className="comment-editor-shell relative h-full overflow-hidden">
            {input.comments.currentSelection?.canCreate ? (
                <button
                    className="comment-selection-action"
                    onClick={input.onCommentStartDraft}
                    style={{
                        left: `${input.comments.currentSelection.rect.left}px`,
                        top: `${Math.max(input.comments.currentSelection.rect.top - 8, 12)}px`,
                    }}
                    type="button"
                >
                    Comment
                </button>
            ) : null}

            {markers.map((marker, index) => (
                <button
                    key={marker.threadId}
                    aria-label={marker.kind === 'detached' ? `Open detached comment ${index + 1}` : `Open comment ${index + 1}`}
                    className={`comment-thread-marker${marker.active ? ' active' : ''}${marker.kind === 'detached' ? ' detached' : ''}${marker.status === 'resolved' ? ' resolved' : ''}`}
                    data-testid="comment-marker"
                    onClick={() => input.onCommentOpenThread(marker.threadId)}
                    style={{ top: `${marker.top}px` }}
                    type="button"
                />
            ))}

            {overlayTop !== null ? (
                <TextCommentsPane
                    containerHeight={containerHeight}
                    draftSelection={input.comments.overlay.kind === 'draft' ? input.comments.overlay.selection : null}
                    onClose={input.onCloseCommentOverlay}
                    onCreateThread={input.onCommentCreateThread}
                    onDeleteMessage={input.onCommentDeleteMessage}
                    onDeleteThread={input.onCommentDeleteThread}
                    onEditMessage={input.onCommentEditMessage}
                    onReopenThread={input.onCommentReopen}
                    onReplyToThread={input.onCommentReply}
                    onResolveThread={input.onCommentResolve}
                    thread={input.comments.overlayThread}
                    top={overlayTop}
                />
            ) : null}
        </div>
    )
}
