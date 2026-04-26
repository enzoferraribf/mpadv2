import {
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
} from '@codemirror/view'
import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { yCollab } from 'y-codemirror.next'
import type { Awareness } from 'y-protocols/awareness'
import type { Doc } from 'yjs'
import { createMarkdownCodeMirrorExtensions } from './codemirror'
import { createRemoteSelectionLineExtension } from './remote-selection-lines'

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

const remoteCursorGuard = EditorView.updateListener.of((update) => {
    if (!update.docChanged && !update.selectionSet && !update.viewportChanged)
        return
    queueMicrotask(() => protectRemoteCursorDom(update.view.dom))
})

export function createTextEditorHandle(
    doc: Doc,
    awareness: Awareness,
): TextEditorHandle {
    const callbacks = {
        onCursorChange: null as ((cursor: CursorPosition) => void) | null,
    }
    let view: EditorView | null = null

    return {
        mount(input) {
            callbacks.onCursorChange = input.onCursorChange
            const ytext = doc.getText(Y_TEXT_KEY)
            view = new EditorView({
                doc: ytext.toString(),
                extensions: [
                    ...createMarkdownCodeMirrorExtensions(),
                    EditorView.contentAttributes.of({
                        'aria-label': 'Pad text editor',
                    }),
                    highlightActiveLine(),
                    highlightActiveLineGutter(),
                    remoteCursorGuard,
                    yCollab(ytext, awareness),
                    createRemoteSelectionLineExtension(ytext, awareness),
                    EditorView.updateListener.of((update) => {
                        if (!update.selectionSet && !update.docChanged) return
                        callbacks.onCursorChange?.(readCursor(update.state))
                    }),
                ],
                parent: input.root,
            })

            callbacks.onCursorChange?.(readCursor(view.state))
            protectRemoteCursorDom(view.dom)

            return () => {
                view?.destroy()
                view = null
                callbacks.onCursorChange = null
            }
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
    for (const element of root.querySelectorAll<HTMLElement>(
        '.cm-ySelectionCaret, .cm-ySelectionInfo, .cm-ySelectionCaretDot',
    )) {
        element.setAttribute('contenteditable', 'false')
        element.setAttribute('aria-hidden', 'true')
        element.setAttribute('draggable', 'false')
        element.setAttribute('translate', 'no')
    }
}

function readCursor(state: EditorView['state']): CursorPosition {
    const head = state.selection.main.head
    const line = state.doc.lineAt(head)

    return {
        line: line.number,
        column: head - line.from + 1,
    }
}
