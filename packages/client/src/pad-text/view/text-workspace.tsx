import 'github-markdown-css/github-markdown.css'
import type { TextPadComments } from '@/pad-text/application/use-text-pad'
import type { TextCommentResult } from '@/pad-text/infrastructure/text-comment-store'
import type { CursorPosition, TextEditorHandle } from '@/pad-text/infrastructure/text-editor'
import { MarkdownEditorPane } from '@/pad-text/markdown-editor-pane'
import { MarkdownPreviewPane } from '@/pad-text/markdown-preview-pane'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

export function TextWorkspace(input: {
    comments: TextPadComments
    content: string
    direction: 'horizontal' | 'vertical'
    editor: TextEditorHandle
    layout: 'split' | 'editor' | 'preview'
    onCloseCommentOverlay: () => void
    onCommentCreate: (body: string) => TextCommentResult<{ threadId: string }>
    onCommentDeleteMessage: (input: { threadId: string; messageId: string }) => TextCommentResult
    onCommentDeleteThread: (threadId: string) => TextCommentResult
    onCommentEditMessage: (input: { threadId: string; messageId: string; body: string }) => TextCommentResult
    onCommentOpenThread: (threadId: string | null) => void
    onCommentReply: (input: { threadId: string; body: string }) => TextCommentResult<{ messageId: string }>
    onCommentResolve: (threadId: string) => TextCommentResult
    onCommentReopen: (threadId: string) => TextCommentResult
    onCommentStartDraft: () => void
    onEditorSelectionChange: Parameters<typeof MarkdownEditorPane>[0]['onSelectionChange']
    onCursorChange: (cursor: CursorPosition) => void
}) {
    const editorPane = (
        <Pane className="bg-[--stone-editor-bg]">
            <MarkdownEditorPane
                comments={input.comments}
                editor={input.editor}
                onCloseCommentOverlay={input.onCloseCommentOverlay}
                onCommentCreateThread={input.onCommentCreate}
                onCommentDeleteMessage={input.onCommentDeleteMessage}
                onCommentDeleteThread={input.onCommentDeleteThread}
                onCommentEditMessage={input.onCommentEditMessage}
                onCommentOpenThread={input.onCommentOpenThread}
                onCommentReopen={input.onCommentReopen}
                onCommentReply={input.onCommentReply}
                onCommentResolve={input.onCommentResolve}
                onCommentStartDraft={input.onCommentStartDraft}
                onCursorChange={input.onCursorChange}
                onSelectionChange={input.onEditorSelectionChange}
            />
        </Pane>
    )
    const previewPane = (
        <Pane className="bg-[--stone-surface]">
            <div className="preview-scroll h-full overflow-y-auto px-10 py-8">
                <MarkdownPreviewPane content={input.content} />
            </div>
        </Pane>
    )
    const mainPane = input.layout === 'editor'
        ? editorPane
        : input.layout === 'preview'
            ? previewPane
            : (
                <ResizablePanelGroup direction={input.direction} className="h-full min-h-0">
                    <ResizablePanel defaultSize={50} minSize={30}>{editorPane}</ResizablePanel>
                    <ResizableHandle className="mx-0 bg-[--stone-border]" />
                    <ResizablePanel defaultSize={50} minSize={30}>{previewPane}</ResizablePanel>
                </ResizablePanelGroup>
            )
    return <section className="workspace-shell min-h-0" data-testid="workspace-shell">{mainPane}</section>
}

function Pane(input: { className?: string; children: React.ReactNode }) {
    return <section className={`h-full min-h-0 overflow-hidden ${input.className ?? ''}`}>{input.children}</section>
}
