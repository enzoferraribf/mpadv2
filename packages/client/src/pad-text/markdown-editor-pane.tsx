import { useEffect, useEffectEvent, useRef } from 'react'
import type { CursorPosition, TextEditorHandle } from './text-editor-handle'

export function MarkdownEditorPane(input: {
    editor: TextEditorHandle
    onCursorChange?: (cursor: CursorPosition) => void
}) {
    const rootRef = useRef<HTMLDivElement | null>(null)
    const onCursorChange = useEffectEvent((cursor: CursorPosition) => {
        if (!input.onCursorChange) return
        input.onCursorChange(cursor)
    })

    useEffect(() => {
        const parent = rootRef.current
        if (!parent) return
        return input.editor.mount({
            root: parent,
            onCursorChange,
        })
    }, [input.editor])

    return <div ref={rootRef} className="h-full overflow-hidden" />
}
