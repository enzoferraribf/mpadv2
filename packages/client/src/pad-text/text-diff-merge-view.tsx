import { EditorState } from '@codemirror/state'
import { MergeView } from '@codemirror/merge'
import { EditorView } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { createMarkdownCodeMirrorExtensions } from '@/pad-text/infrastructure/markdown-codemirror'

export function TextDiffMergeView(input: {
    leftContent: string
    rightContent: string
}) {
    const rootRef = useRef<HTMLDivElement | null>(null)
    const mergeRef = useRef<MergeView | null>(null)

    useEffect(() => {
        const root = rootRef.current
        if (!root) return

        const merge = new MergeView({
            parent: root,
            highlightChanges: true,
            gutter: true,
            a: {
                doc: input.leftContent,
                extensions: createReadOnlyDiffExtensions(),
            },
            b: {
                doc: input.rightContent,
                extensions: createReadOnlyDiffExtensions(),
            },
        })

        mergeRef.current = merge

        return () => {
            merge.destroy()
            mergeRef.current = null
        }
    }, [])

    useEffect(() => {
        writeDoc(mergeRef.current?.a ?? null, input.leftContent)
    }, [input.leftContent])

    useEffect(() => {
        writeDoc(mergeRef.current?.b ?? null, input.rightContent)
    }, [input.rightContent])

    return <div ref={rootRef} className="diff-merge-root" data-testid="text-diff-merge" />
}

function createReadOnlyDiffExtensions() {
    return [
        ...createMarkdownCodeMirrorExtensions(),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
    ]
}

function writeDoc(view: EditorView | null, content: string) {
    if (!view) return
    if (view.state.doc.toString() === content) return
    view.dispatch({
        changes: {
            from: 0,
            to: view.state.doc.length,
            insert: content,
        },
    })
}
