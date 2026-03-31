import type { LiveFileState, PadPath, PadTreeItem } from '@mmpad/shared'
import { padPathName } from '@mmpad/shared'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { Settings2 } from 'lucide-react'
import { DrawingSettingsDialog } from '@/pad-drawing/drawing-settings-dialog'
import type { DrawingHandle } from '@/pad-drawing/drawing-handle'
import type { DrawingTheme } from '@/pad-drawing/drawing-theme'
import { FileTransferProgress } from '@/pad-files/file-transfer-progress'
import { FilesDialog } from '@/pad-files/files-dialog'
import { TreeDialog } from '@/pad-tree/tree-dialog'
import { formatFileSize } from '@/lib/file'
import { MarkdownEditorPane } from '@/pad-text/markdown-editor-pane'
import { MarkdownPreviewPane } from '@/pad-text/markdown-preview-pane'
import type { CursorPosition, TextEditorHandle } from '@/pad-text/text-editor-handle'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { CommandMenu } from '@/workspace/command-menu'
import { usePadWorkspace, type PadWorkspaceModel, type PadWorkspaceState } from '@/workspace/use-pad-workspace'

const LazyDrawingWorkspace = lazy(() => import('@/pad-drawing/drawing-workspace').then((mod) => ({ default: mod.DrawingWorkspace })))

export function PadPage({ path }: { path: PadPath }) {
    const workspace = usePadWorkspace(path)

    useEffect(() => {
        if (import.meta.env.VITE_E2E !== '1') return
        void import('@/test/window-state').then(({ publishWindowState }) => {
            publishWindowState(workspace)
        })
    }, [workspace])

    if (workspace.state.kind === 'loading') {
        return (
            <main className="app-shell" data-testid="pad-page">
                <PadTopBar workspace={workspace} />
                <LoadingPadPage workspace={workspace} />
                <WorkspaceDialogs workspace={workspace} />
            </main>
        )
    }

    const readyWorkspace: PadWorkspaceModel & {
        state: Extract<PadWorkspaceState, { kind: 'ready' }>
    } = {
        ...workspace,
        state: workspace.state,
    }

    return (
        <main className="app-shell" data-testid="pad-page">
            <PadTopBar workspace={workspace} />
            <ReadyPadPage workspace={readyWorkspace} />
            <WorkspaceDialogs workspace={workspace} />
        </main>
    )
}

function PadTopBar(input: { workspace: PadWorkspaceModel }) {
    const { actions, state } = input.workspace

    return (
        <div className="app-topbar">
            <div className="app-topbar-left">
                <button className="app-topbar-toggle" onClick={actions.toggleSidebar} title="Toggle sidebar (Ctrl+B)">&#x2630;</button>
            </div>
            <div className="app-topbar-center">
                <a href="/" className="mpad-logo"><span className="mpad-logo-m">M</span>PAD</a>
            </div>
            <div className="app-topbar-right">
                <div className="pad-tabs">
                    <button className={`pad-tab${state.view.activeTab === 'text' ? ' active' : ''}`} onClick={() => actions.openTab('text')}>{state.view.padName}</button>
                    <button className={`pad-tab${state.view.activeTab === 'drawing' ? ' active' : ''}`} onClick={() => actions.openTab('drawing')}>Drawing</button>
                    <button className={`pad-tab${state.view.activeTab === 'files' ? ' active' : ''}`} onClick={() => actions.openTab('files')}>Files</button>
                </div>
                {state.view.activeTab === 'text' ? (
                    <div className="pad-tab-actions">
                        <button className={`pad-tab-action${state.view.layout === 'split' ? ' active' : ''}`} onClick={() => actions.setLayout('split')} title="Split view">&#x2637;</button>
                        <button className={`pad-tab-action${state.view.layout === 'editor' ? ' active' : ''}`} onClick={() => actions.setLayout('editor')} title="Editor only">&#x270E;</button>
                        <button className={`pad-tab-action${state.view.layout === 'preview' ? ' active' : ''}`} onClick={() => actions.setLayout('preview')} title="Preview only">&#x25C9;</button>
                    </div>
                ) : null}
                {state.view.activeTab === 'drawing' ? (
                    <div className="pad-tab-actions">
                        <button
                            className={`pad-tab-action${state.view.dialog === 'drawing-settings' ? ' active' : ''}`}
                            onClick={() => actions.toggleDialog('drawing-settings')}
                            title="Drawing settings"
                            aria-label="Drawing settings"
                        >
                            <Settings2 className="h-4 w-4" />
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

function LoadingPadPage(input: { workspace: PadWorkspaceModel }) {
    const { actions, state } = input.workspace

    return (
        <div className="app-content">
            {state.view.sidebarOpen ? (
                <PadSidebar
                    path={state.view.path}
                    tree={[]}
                    onNavigate={actions.navigateToPad}
                />
            ) : null}
            <div className="app-main">
                <section className="loading-shell workspace-shell">
                    <div className="loading-card">
                        <span className="mpad-logo mpad-logo-lg"><span className="mpad-logo-m">M</span>PAD</span>
                        <p className="text-sm text-[--stone-text-secondary]">{state.view.phrase}</p>
                    </div>
                </section>
                <PadStatusBar
                    path={state.view.path}
                    connection={state.status.connection}
                    peerCount={state.status.peerCount}
                    clockLabel={state.view.clockLabel}
                    cursorLabel={state.view.cursorLabel}
                />
            </div>
        </div>
    )
}

function ReadyPadPage(input: { workspace: PadWorkspaceModel & { state: Extract<PadWorkspaceState, { kind: 'ready' }> } }) {
    const { actions, state } = input.workspace
    const drawing = state.drawing.kind === 'ready' ? state.drawing.drawing : null

    return (
        <div className="app-content">
            {state.view.sidebarOpen ? (
                <PadSidebar
                    path={state.view.path}
                    tree={state.status.tree}
                    onNavigate={actions.navigateToPad}
                />
            ) : null}
            <div className="app-main">
                {state.view.activeTab === 'files' ? (
                    <FilesPane
                        files={state.status.files}
                        onDeleteFile={actions.deleteFile}
                        onDownloadFile={actions.downloadFile}
                        onUploadFile={actions.uploadFile}
                    />
                ) : state.view.activeTab === 'drawing' ? (
                    <DrawingTabWorkspace
                        drawing={drawing}
                        theme={state.view.drawingTheme}
                    />
                ) : (
                    <TextWorkspace
                        content={state.text.content}
                        direction={state.view.splitDirection}
                        editor={state.text.editor}
                        layout={state.view.layout}
                        onCursorChange={actions.setCursor}
                    />
                )}
                <PadStatusBar
                    path={state.view.path}
                    connection={state.status.connection}
                    peerCount={state.status.peerCount}
                    clockLabel={state.view.clockLabel}
                    cursorLabel={state.view.cursorLabel}
                />
            </div>
        </div>
    )
}

function WorkspaceDialogs(input: { workspace: PadWorkspaceModel }) {
    const { actions, state } = input.workspace
    const tree = state.status.tree
    const files = state.status.files

    return (
        <>
            <CommandMenu
                open={state.view.dialog === 'command'}
                onOpenChange={(open) => open ? actions.openDialog('command') : actions.closeDialog()}
                actions={actions}
            />
            <TreeDialog
                open={state.view.dialog === 'tree'}
                onOpenChange={(open) => open ? actions.openDialog('tree') : actions.closeDialog()}
                path={state.view.path}
                tree={tree}
                onSelect={actions.navigateToPad}
            />
            <FilesDialog
                open={state.view.dialog === 'files'}
                onOpenChange={(open) => open ? actions.openDialog('files') : actions.closeDialog()}
                path={state.view.path}
                files={files}
                onDelete={actions.deleteFile}
                onDownload={actions.downloadFile}
            />
            <DrawingSettingsDialog
                open={state.view.dialog === 'drawing-settings'}
                onOpenChange={(open) => open ? actions.openDialog('drawing-settings') : actions.closeDialog()}
                preference={state.view.drawingThemePreference}
                onPreferenceChange={actions.setDrawingThemePreference}
            />
        </>
    )
}

function PadSidebar(input: {
    path: PadPath
    tree: PadTreeItem[]
    onNavigate: (path: PadPath) => void
}) {
    const [helpOpen, setHelpOpen] = useState(false)
    const items = input.tree.length > 0 ? input.tree : [{ path: input.path, parentPath: null, name: padPathName(input.path) }]

    return (
        <aside className="pad-sidebar">
            <div className="pad-sidebar-section-label" style={{ padding: '12px 16px 4px' }}>Explorer</div>
            <nav className="pad-explorer">
                {items.map((item) => (
                    <button
                        key={item.path}
                        className={`pad-explorer-item${item.path === input.path ? ' active' : ''}`}
                        onClick={() => input.onNavigate(item.path)}
                    >
                        {item.path}
                    </button>
                ))}
            </nav>
            <div className="pad-sidebar-footer">
                <button className="pad-sidebar-help-btn" onClick={() => setHelpOpen((value) => !value)} title="Markdown help">?</button>
                {helpOpen ? (
                    <div className="pad-sidebar-help">
                        <div className="pad-sidebar-help-row"><code>#</code> Heading &nbsp; <code>**b**</code> Bold &nbsp; <code>*i*</code> Italic</div>
                        <div className="pad-sidebar-help-row"><code>- item</code> List &nbsp; <code>&gt;</code> Quote &nbsp; <code>`code`</code></div>
                        <div className="pad-sidebar-help-row"><code>[text](url)</code> Link &nbsp; <code>```</code> Code block</div>
                    </div>
                ) : null}
            </div>
        </aside>
    )
}

function FilesPane(input: {
    files: LiveFileState[]
    onDeleteFile: (id: string) => void
    onDownloadFile: (file: LiveFileState) => void
    onUploadFile: (file: File) => void
}) {
    const [dragging, setDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const handleDragOver = (event: DragEvent) => {
        event.preventDefault()
        setDragging(true)
    }
    const handleDragLeave = () => setDragging(false)
    const handleDrop = (event: DragEvent) => {
        event.preventDefault()
        setDragging(false)
        const file = event.dataTransfer.files[0]
        if (file) input.onUploadFile(file)
    }
    const handleFileSelect = () => {
        const file = fileInputRef.current?.files?.[0]
        if (file) input.onUploadFile(file)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    return (
        <section
            className={`files-pane workspace-shell min-h-0${dragging ? ' dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="workspace-shell"
        >
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            {input.files.length > 0 ? (
                <div className="files-grid">
                    {input.files.map((file) => (
                        <div
                            key={file.meta.id}
                            className="files-card"
                            role="button"
                            tabIndex={0}
                            onClick={() => input.onDownloadFile(file)}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return
                                event.preventDefault()
                                input.onDownloadFile(file)
                            }}
                        >
                            <div className="files-card-icon">&#x1F4C4;</div>
                            <div className="files-card-name" title={file.meta.name}>{file.meta.name}</div>
                            <div className="files-card-size">{formatFileSize(file.meta.sizeBytes)}</div>
                            <FileTransferProgress file={file} compact />
                            {file.isLocal ? (
                                <button className="files-card-delete" onClick={(event) => { event.stopPropagation(); input.onDeleteFile(file.meta.id) }} title="Remove">&times;</button>
                            ) : null}
                        </div>
                    ))}
                    <button className="files-card files-card-add" onClick={() => fileInputRef.current?.click()}>
                        <div className="files-card-icon">&#x2B;</div>
                        <div className="files-card-name">Add file</div>
                    </button>
                </div>
            ) : (
                <div className="files-empty" role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()}>
                    Tap or drop files to share
                </div>
            )}
        </section>
    )
}

function DrawingTabWorkspace(input: {
    drawing: DrawingHandle | null
    theme: DrawingTheme
}) {
    return (
        <section className="workspace-shell min-h-0" data-testid="workspace-shell">
            <Pane className="bg-[--stone-editor-bg]">
                <Suspense fallback={<DrawingWorkspaceFallback />}>
                    <LazyDrawingWorkspace drawing={input.drawing} theme={input.theme} />
                </Suspense>
            </Pane>
        </section>
    )
}

function PadStatusBar(input: {
    path: PadPath
    connection: 'connecting' | 'connected' | 'disconnected'
    peerCount: number
    clockLabel: string
    cursorLabel: string
}) {
    return (
        <footer className="pad-statusbar">
            <span className="pad-statusbar-segment">{input.path.split('/').filter(Boolean).join(' / ')}</span>
            <span className="pad-statusbar-segment pad-statusbar-conn">
                <span className={`pad-statusbar-dot ${input.connection}`} />
                {input.peerCount} peer{input.peerCount !== 1 ? 's' : ''}
            </span>
            <span className="pad-statusbar-segment" data-testid="status-cursor">{input.cursorLabel}</span>
            <span className="pad-statusbar-segment" data-testid="status-clock">{input.clockLabel}</span>
        </footer>
    )
}

function TextWorkspace(input: {
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

function Pane(input: { className?: string; children: ReactNode }) {
    return <section className={`h-full min-h-0 overflow-hidden ${input.className ?? ''}`}>{input.children}</section>
}

function DrawingWorkspaceFallback() {
    return (
        <div className="flex h-full items-center justify-center text-sm text-[--stone-text-dim]" data-testid="drawing-workspace">
            Loading drawing…
        </div>
    )
}
