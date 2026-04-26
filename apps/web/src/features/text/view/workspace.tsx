import 'github-markdown-css/github-markdown.css'
import type {
    CursorPosition,
    TextEditorHandle,
} from '@/features/text/application/editor'
import { MarkdownEditorPane } from '@/features/text/view/editor-pane'
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/features/text/view/resizable'
import { Suspense, lazy, useEffect, useState } from 'react'

const LazyMarkdownPreviewPane = lazy(() =>
    import('@/features/text/view/preview-pane').then((mod) => ({
        default: mod.MarkdownPreviewPane,
    })),
)

export function TextWorkspace(input: {
    direction: 'horizontal' | 'vertical'
    editor: TextEditorHandle
    layout: 'split' | 'editor' | 'preview'
    onCursorChange: (cursor: CursorPosition) => void
}) {
    const editorPane = (
        <Pane className='bg-[--stone-editor-bg]'>
            <MarkdownEditorPane
                editor={input.editor}
                onCursorChange={input.onCursorChange}
            />
        </Pane>
    )
    const previewPane = (
        <Pane className='bg-[--stone-surface]'>
            <div className='preview-scroll h-full overflow-y-auto px-10 py-8'>
                <Suspense fallback={<PreviewFallback />}>
                    <MarkdownPreview editor={input.editor} />
                </Suspense>
            </div>
        </Pane>
    )
    const mainPane = readMainPane({
        direction: input.direction,
        editorPane,
        layout: input.layout,
        previewPane,
    })
    return (
        <section
            className='workspace-shell min-h-0'
            data-testid='workspace-shell'
        >
            {mainPane}
        </section>
    )
}

function MarkdownPreview(input: { editor: TextEditorHandle }) {
    const [content, setContent] = useState(() => input.editor.readContent())

    useEffect(() => {
        setContent(input.editor.readContent())
        return input.editor.subscribe(() =>
            setContent(input.editor.readContent()),
        )
    }, [input.editor])

    return <LazyMarkdownPreviewPane content={content} />
}

function PreviewFallback() {
    return (
        <div className='space-y-4 pt-2'>
            <div className='lazy-line wide' />
            <div className='lazy-line' />
            <div className='lazy-line short' />
            <div className='lazy-preview-block' />
        </div>
    )
}

function readMainPane(input: {
    direction: 'horizontal' | 'vertical'
    editorPane: React.ReactNode
    layout: 'split' | 'editor' | 'preview'
    previewPane: React.ReactNode
}) {
    switch (input.layout) {
        case 'editor':
            return input.editorPane
        case 'preview':
            return input.previewPane
        case 'split':
            return (
                <ResizablePanelGroup
                    autoSaveId='pad-text-split'
                    direction={input.direction}
                    className='h-full min-h-0'
                >
                    <ResizablePanel defaultSize={50} minSize={30}>
                        {input.editorPane}
                    </ResizablePanel>
                    <ResizableHandle
                        className='mx-0 bg-[--stone-border]'
                        withHandle
                    />
                    <ResizablePanel defaultSize={50} minSize={30}>
                        {input.previewPane}
                    </ResizablePanel>
                </ResizablePanelGroup>
            )
    }
}

function Pane(input: { className?: string; children: React.ReactNode }) {
    return (
        <section
            className={`h-full min-h-0 overflow-hidden ${input.className ?? ''}`}
        >
            {input.children}
        </section>
    )
}
