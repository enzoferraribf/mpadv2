import { Y_TEXT_KEY } from '@mmpad/shared'
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'
import type { Awareness } from 'y-protocols/awareness'
import { yCollab } from 'y-codemirror.next'
import type { Doc } from 'yjs'

export type CursorPosition = {
    line: number
    column: number
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
        paddingTop: '28px',
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
        backgroundColor: 'rgba(201, 168, 124, 0.06)',
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
})

export function MarkdownEditorPane(input: {
    doc: Doc
    awareness: Awareness
    onCursorChange?: (cursor: CursorPosition) => void
}) {
    const rootRef = useRef<HTMLDivElement | null>(null)
    const { resolvedTheme } = useTheme()

    useEffect(() => {
        const parent = rootRef.current
        if (!parent) return

        const ytext = input.doc.getText(Y_TEXT_KEY)
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
                yCollab(ytext, input.awareness),
                EditorView.updateListener.of((update) => {
                    if (!update.selectionSet && !update.docChanged) return
                    if (!input.onCursorChange) return
                    input.onCursorChange(readCursor(update.state))
                }),
            ],
            parent,
        })

        if (input.onCursorChange) input.onCursorChange(readCursor(view.state))

        return () => view.destroy()
    }, [input.awareness, input.doc, input.onCursorChange, resolvedTheme])

    return <div ref={rootRef} className="h-full overflow-hidden" />
}

function readCursor(state: EditorView['state']): CursorPosition {
    const head = state.selection.main.head
    const line = state.doc.lineAt(head)

    return {
        line: line.number,
        column: head - line.from + 1,
    }
}
