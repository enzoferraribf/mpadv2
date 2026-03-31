import { Y_TEXT_KEY } from '@mmpad/shared'
import { EditorView, ViewPlugin, drawSelection, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { markdown } from '@codemirror/lang-markdown'
import type { Awareness } from 'y-protocols/awareness'
import { yCollab } from 'y-codemirror.next'
import type { Doc } from 'yjs'

export type CursorPosition = {
    line: number
    column: number
}

export type TextEditorHandle = {
    mount: (input: {
        root: HTMLDivElement
        onCursorChange: ((cursor: CursorPosition) => void) | null
    }) => () => void
    appendText: (content: string) => void
    readContent: () => string
    subscribe: (listener: () => void) => () => void
}

const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        backgroundColor: '#201f1b',
        color: '#e6e0d6',
        fontSize: '13px',
    },
    '.cm-scroller': {
        overflow: 'auto',
        fontFamily: "'Fira Code', monospace",
        lineHeight: '1.8',
    },
    '.cm-content': {
        minHeight: '100%',
        paddingTop: '36px',
        paddingBottom: '28px',
    },
    '.cm-line': {
        paddingLeft: '8px',
        paddingRight: '24px',
    },
    '.cm-gutters': {
        minWidth: '40px',
        border: 'none',
        backgroundColor: 'transparent',
        color: '#524e47',
    },
    '.cm-gutterElement': {
        padding: '0 12px 0 14px',
        fontSize: '11px',
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
    },
    '.cm-activeLine': {
        backgroundColor: 'rgba(201, 168, 124, 0.04)',
    },
    '& .cm-cursorLayer .cm-cursor': {
        display: 'block',
        borderLeft: 'none !important',
        border: '1px solid #ffffff !important',
        backgroundColor: 'transparent !important',
        width: '1ch',
        marginLeft: '0 !important',
        boxSizing: 'border-box',
    },
    '.cm-selectionBackground': {
        backgroundColor: 'rgba(201, 168, 124, 0.15) !important',
    },
    '.cm-ySelectionInfo': {
        top: '-1.9em',
        left: '-2px',
        opacity: '1',
        padding: '2px 7px',
        borderRadius: '999px',
        fontFamily: "'Assistant', sans-serif",
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.02em',
        lineHeight: '1.2',
        boxShadow: '0 1px 0 rgba(12, 12, 12, 0.35)',
        transition: 'none',
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
    },
    '.cm-ySelectionCaret': {
        marginLeft: '-1px',
        marginRight: '-1px',
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
    },
    '.cm-ySelectionCaretDot': {
        width: '0.5em',
        height: '0.5em',
        top: '-0.25em',
        left: '-0.25em',
        boxShadow: '0 0 0 2px #201f1b',
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
    },
    '.cm-ySelectionCaret:hover > .cm-ySelectionInfo': {
        opacity: '1',
    },
})

const editorHighlight = syntaxHighlighting(HighlightStyle.define([
    { tag: tags.heading1, color: '#e6e0d6', fontWeight: '700', fontSize: '1.4em' },
    { tag: tags.heading2, color: '#e6e0d6', fontWeight: '600', fontSize: '1.2em' },
    { tag: tags.heading3, color: '#c9a87c', fontWeight: '600', fontSize: '1.05em' },
    { tag: [tags.heading4, tags.heading5, tags.heading6], color: '#c9a87c', fontWeight: '600' },
    { tag: tags.strong, color: '#e6e0d6', fontWeight: '600' },
    { tag: tags.emphasis, color: '#b5afa5', fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through', color: '#8a8279' },
    { tag: tags.link, color: '#c9a87c', textDecoration: 'underline' },
    { tag: tags.url, color: '#8a8279' },
    { tag: [tags.processingInstruction, tags.inserted], color: '#7c9c8a' },
    { tag: tags.monospace, color: '#e6e0d6', backgroundColor: 'rgba(255,255,255,0.03)' },
    { tag: [tags.meta, tags.comment], color: '#524e47' },
    { tag: tags.labelName, color: '#c9a87c' },
    { tag: tags.quote, color: '#8a8279', fontStyle: 'italic' },
    { tag: tags.list, color: '#c9a87c' },
    { tag: tags.contentSeparator, color: '#524e47' },
]))

const remoteCursorGuard = ViewPlugin.fromClass(class {
    constructor(view: EditorView) {
        scheduleRemoteCursorProtection(view.dom)
    }

    update(update: { view: EditorView }) {
        scheduleRemoteCursorProtection(update.view.dom)
    }
})

export function createTextEditorHandle(doc: Doc, awareness: Awareness): TextEditorHandle {
    return {
        mount(input) {
            const ytext = doc.getText(Y_TEXT_KEY)
            const view = new EditorView({
                doc: ytext.toString(),
                extensions: [
                    markdown(),
                    lineNumbers(),
                    EditorView.lineWrapping,
                    drawSelection(),
                    highlightActiveLine(),
                    highlightActiveLineGutter(),
                    editorTheme,
                    editorHighlight,
                    remoteCursorGuard,
                    yCollab(ytext, awareness),
                    EditorView.updateListener.of((update) => {
                        if (!update.selectionSet && !update.docChanged) return
                        if (!input.onCursorChange) return
                        input.onCursorChange(readCursor(update.state))
                    }),
                ],
                parent: input.root,
            })

            if (input.onCursorChange) input.onCursorChange(readCursor(view.state))
            return () => view.destroy()
        },
        appendText(content) {
            const text = doc.getText(Y_TEXT_KEY)
            text.insert(text.length, content)
        },
        readContent() {
            return doc.getText(Y_TEXT_KEY).toString()
        },
        subscribe(listener) {
            doc.on('update', listener)
            return () => doc.off('update', listener)
        },
    }
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
