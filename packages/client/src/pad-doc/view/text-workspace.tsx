import type { CursorPosition, TextEditorHandle } from '@/pad-text/text-editor-handle'
import { MarkdownEditorPane } from '@/pad-text/markdown-editor-pane'
import { MarkdownPreviewPane } from '@/pad-text/markdown-preview-pane'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

export function TextWorkspace(input: {
    content: string
    direction: 'horizontal' | 'vertical'
    editor: TextEditorHandle
    layout: 'split' | 'editor' | 'preview'
    onCursorChange: (cursor: CursorPosition) => void
}) {
    const editorPane = (
        <Pane className="bg-[--stone-editor-bg]">
            <MarkdownEditorPane editor={input.editor} onCursorChange={input.onCursorChange} />
        </Pane>
    )
    const previewPane = (
        <Pane className="bg-[--stone-surface]">
            <div className="preview-scroll h-full overflow-y-auto px-10 py-8">
                <MarkdownPreviewPane content={input.content} />
            </div>
        </Pane>
    )

    if (input.layout === 'editor') return <section className="workspace-shell min-h-0" data-testid="workspace-shell">{editorPane}</section>
    if (input.layout === 'preview') return <section className="workspace-shell min-h-0" data-testid="workspace-shell">{previewPane}</section>

    return (
        <section className="workspace-shell min-h-0" data-testid="workspace-shell">
            <ResizablePanelGroup direction={input.direction} className="h-full min-h-0">
                <ResizablePanel defaultSize={50} minSize={30}>{editorPane}</ResizablePanel>
                <ResizableHandle className="mx-0 bg-[--stone-border]" />
                <ResizablePanel defaultSize={50} minSize={30}>{previewPane}</ResizablePanel>
            </ResizablePanelGroup>
        </section>
    )
}

function Pane(input: { className?: string; children: React.ReactNode }) {
    return <section className={`h-full min-h-0 overflow-hidden ${input.className ?? ''}`}>{input.children}</section>
}
