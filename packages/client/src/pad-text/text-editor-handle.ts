import { Y_TEXT_KEY } from '@mmpad/shared'
import { EditorView, ViewPlugin, drawSelection, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import type { Awareness } from 'y-protocols/awareness'
import { yCollab } from 'y-codemirror.next'
import type { Doc } from 'yjs'
import { createMarkdownCodeMirrorExtensions } from './markdown-codemirror'

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

export function createTextEditorHandle(doc: Doc, awareness: Awareness): TextEditorHandle {
    return {
        mount(input) {
            const ytext = doc.getText(Y_TEXT_KEY)
            const view = new EditorView({
                doc: ytext.toString(),
                extensions: [
                    ...createMarkdownCodeMirrorExtensions(),
                    drawSelection(),
                    highlightActiveLine(),
                    highlightActiveLineGutter(),
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
