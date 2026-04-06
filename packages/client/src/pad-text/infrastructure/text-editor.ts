import { Y_TEXT_KEY } from '@mpad/shared'
import { StateEffect, StateField } from '@codemirror/state'
import {
    Decoration,
    EditorView,
    ViewPlugin,
    drawSelection,
    highlightActiveLine,
    highlightActiveLineGutter,
} from '@codemirror/view'
import type { Awareness } from 'y-protocols/awareness'
import { yCollab } from 'y-codemirror.next'
import type { Doc } from 'yjs'
import { createMarkdownCodeMirrorExtensions } from './markdown-codemirror'
import type { TextCommentHighlight } from './text-comment-store'
import type { TextCommentRangeRect } from '@/pad-text/domain/comment-overlay'

export type CursorPosition = {
    line: number
    column: number
}

export type TextEditorSelection = {
    from: number
    to: number
    quote: string
    rect: {
        left: number
        top: number
        bottom: number
    }
}

export type TextEditorHandle = {
    mount: (input: {
        root: HTMLDivElement
        onCursorChange: ((cursor: CursorPosition) => void) | null
        onCommentClick: ((threadId: string) => void) | null
        onLayoutChange: (() => void) | null
        onSelectionChange: ((selection: TextEditorSelection | null) => void) | null
    }) => () => void
    appendText: (content: string) => void
    measureCommentRange: (from: number, to: number) => TextCommentRangeRect | null
    readContent: () => string
    selectRange: (from: number, to: number) => void
    setActiveCommentThread: (threadId: string | null) => void
    setCommentHighlights: (highlights: TextCommentHighlight[]) => void
    setText: (content: string) => void
    subscribe: (listener: () => void) => () => void
}

const remoteCursorGuard = ViewPlugin.fromClass(class {
    constructor(view: EditorView) {
        scheduleRemoteCursorProtection(view.dom)
    }

    update(update: { view: EditorView }) {
        scheduleRemoteCursorProtection(update.view.dom)
    }
})

const setCommentHighlightsEffect = StateEffect.define<TextCommentHighlight[]>()
const setActiveCommentThreadEffect = StateEffect.define<string | null>()

const commentDecorationsField = StateField.define<{
    activeThreadId: string | null
    decorations: ReturnType<typeof buildCommentDecorations>
    highlights: TextCommentHighlight[]
}>({
    create() {
        return {
            activeThreadId: null,
            decorations: Decoration.none,
            highlights: [],
        }
    },
    update(value, transaction) {
        let highlights = value.highlights
        let activeThreadId = value.activeThreadId
        let changed = transaction.docChanged

        for (const effect of transaction.effects) {
            if (effect.is(setCommentHighlightsEffect)) {
                highlights = effect.value
                changed = true
            }
            if (effect.is(setActiveCommentThreadEffect)) {
                activeThreadId = effect.value
                changed = true
            }
        }

        if (!changed) return value

        return {
            activeThreadId,
            decorations: buildCommentDecorations(highlights, activeThreadId),
            highlights,
        }
    },
    provide(field) {
        return EditorView.decorations.from(field, (value) => value.decorations)
    },
})

export function createTextEditorHandle(doc: Doc, awareness: Awareness): TextEditorHandle {
    const callbacks = {
        onCommentClick: null as ((threadId: string) => void) | null,
        onCursorChange: null as ((cursor: CursorPosition) => void) | null,
        onLayoutChange: null as (() => void) | null,
        onSelectionChange: null as ((selection: TextEditorSelection | null) => void) | null,
        root: null as HTMLDivElement | null,
    }
    let activeCommentThreadId: string | null = null
    let commentHighlights: TextCommentHighlight[] = []
    let view: EditorView | null = null
    const commentInteraction = ViewPlugin.fromClass(class {
    }, {
        eventHandlers: {
            click(event) {
                const target = event.target instanceof HTMLElement
                    ? event.target.closest<HTMLElement>('[data-comment-thread-id]')
                    : null
                const threadId = target?.dataset.commentThreadId
                if (!threadId) return false
                callbacks.onCommentClick?.(threadId)
                return true
            },
        },
    })

    return {
        mount(input) {
            callbacks.root = input.root
            callbacks.onCommentClick = input.onCommentClick
            callbacks.onCursorChange = input.onCursorChange
            callbacks.onLayoutChange = input.onLayoutChange
            callbacks.onSelectionChange = input.onSelectionChange
            const ytext = doc.getText(Y_TEXT_KEY)
            view = new EditorView({
                doc: ytext.toString(),
                extensions: [
                    ...createMarkdownCodeMirrorExtensions(),
                    EditorView.contentAttributes.of({
                        'aria-label': 'Pad text editor',
                    }),
                    drawSelection(),
                    highlightActiveLine(),
                    highlightActiveLineGutter(),
                    remoteCursorGuard,
                    commentDecorationsField,
                    commentInteraction,
                    yCollab(ytext, awareness),
                    EditorView.updateListener.of((update) => {
                        if (!update.selectionSet && !update.docChanged) return
                        callbacks.onCursorChange?.(readCursor(update.state))
                        callbacks.onSelectionChange?.(readSelection(update.view, callbacks.root))
                        callbacks.onLayoutChange?.()
                    }),
                ],
                parent: input.root,
            })
            const onScroll = () => callbacks.onLayoutChange?.()
            view.scrollDOM.addEventListener('scroll', onScroll)

            syncCommentDecorations(view, commentHighlights, activeCommentThreadId)
            callbacks.onCursorChange?.(readCursor(view.state))
            callbacks.onSelectionChange?.(readSelection(view, callbacks.root))
            callbacks.onLayoutChange?.()

            return () => {
                view?.scrollDOM.removeEventListener('scroll', onScroll)
                view?.destroy()
                view = null
                callbacks.root = null
                callbacks.onCommentClick = null
                callbacks.onCursorChange = null
                callbacks.onLayoutChange = null
                callbacks.onSelectionChange = null
            }
        },
        appendText(content) {
            const text = doc.getText(Y_TEXT_KEY)
            text.insert(text.length, content)
        },
        measureCommentRange(from, to) {
            return readRangeRect(view, callbacks.root, from, to)
        },
        readContent() {
            return doc.getText(Y_TEXT_KEY).toString()
        },
        selectRange(from, to) {
            if (!view) return
            view.dispatch({
                selection: {
                    anchor: Math.max(0, from),
                    head: Math.max(0, to),
                },
                scrollIntoView: true,
            })
            view.focus()
            callbacks.onLayoutChange?.()
        },
        setActiveCommentThread(threadId) {
            activeCommentThreadId = threadId
            if (!view) return
            syncCommentDecorations(view, commentHighlights, activeCommentThreadId)
            callbacks.onLayoutChange?.()
        },
        setCommentHighlights(highlights) {
            commentHighlights = highlights
            if (!view) return
            syncCommentDecorations(view, commentHighlights, activeCommentThreadId)
            callbacks.onLayoutChange?.()
        },
        setText(content) {
            const text = doc.getText(Y_TEXT_KEY)
            text.delete(0, text.length)
            text.insert(0, content)
        },
        subscribe(listener) {
            doc.on('update', listener)
            return () => doc.off('update', listener)
        },
    }
}

function syncCommentDecorations(view: EditorView, highlights: TextCommentHighlight[], activeThreadId: string | null) {
    view.dispatch({
        effects: [
            setCommentHighlightsEffect.of(highlights),
            setActiveCommentThreadEffect.of(activeThreadId),
        ],
    })
}

function protectRemoteCursorDom(root: HTMLElement) {
    for (const element of root.querySelectorAll<HTMLElement>('.cm-ySelectionCaret, .cm-ySelectionInfo, .cm-ySelectionCaretDot')) {
        element.setAttribute('contenteditable', 'false')
        element.setAttribute('aria-hidden', 'true')
        element.setAttribute('draggable', 'false')
        element.setAttribute('translate', 'no')
    }
}

function scheduleRemoteCursorProtection(root: HTMLElement) {
    queueMicrotask(() => protectRemoteCursorDom(root))
}

function readCursor(state: EditorView['state']): CursorPosition {
    const head = state.selection.main.head
    const line = state.doc.lineAt(head)

    return {
        line: line.number,
        column: head - line.from + 1,
    }
}

function readSelection(view: EditorView, root: HTMLDivElement | null): TextEditorSelection | null {
    const { main, ranges } = view.state.selection
    if (ranges.length !== 1 || main.empty || !root) return null

    const from = Math.min(main.from, main.to)
    const to = Math.max(main.from, main.to)
    const rangeRect = readRangeRect(view, root, from, to)
    if (!rangeRect) return null

    return {
        from,
        to,
        quote: view.state.sliceDoc(from, to),
        rect: {
            left: readRangeCenterX(view, root, from, to),
            top: rangeRect.top,
            bottom: rangeRect.bottom,
        },
    }
}

function readRangeCenterX(view: EditorView, root: HTMLDivElement, from: number, to: number) {
    const start = view.coordsAtPos(from)
    const end = view.coordsAtPos(to)
    if (!start || !end) return 24
    const rootRect = root.getBoundingClientRect()
    return ((start.left + end.right) / 2) - rootRect.left
}

function readRangeRect(view: EditorView | null, root: HTMLDivElement | null, from: number, to: number): TextCommentRangeRect | null {
    if (!view || !root || to <= from) return null
    const start = view.coordsAtPos(from)
    const end = view.coordsAtPos(to)
    if (!start || !end) return null

    const rootRect = root.getBoundingClientRect()

    return {
        top: Math.min(start.top, end.top) - rootRect.top,
        bottom: Math.max(start.bottom, end.bottom) - rootRect.top,
    }
}

function buildCommentDecorations(highlights: TextCommentHighlight[], activeThreadId: string | null) {
    const ranges = highlights
        .filter((highlight) => highlight.to > highlight.from)
        .map((highlight) => Decoration.mark({
            attributes: {
                'data-comment-thread-id': highlight.threadId,
            },
            class: readCommentClassName(highlight, activeThreadId),
        }).range(highlight.from, highlight.to))

    return Decoration.set(ranges, true)
}

function readCommentClassName(highlight: TextCommentHighlight, activeThreadId: string | null) {
    const classes = ['cm-comment-highlight']
    if (highlight.status === 'resolved') classes.push('cm-comment-highlight-resolved')
    if (highlight.threadId === activeThreadId) classes.push('cm-comment-highlight-active')
    return classes.join(' ')
}
