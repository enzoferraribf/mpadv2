import type { PadPath, PadTreeItem, LiveFileState } from '@mmpad/shared'
import { padPathName } from '@mmpad/shared'
import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { ReactNode, DragEvent } from 'react'
import type { DialogName } from '@/shell/dialog-name'
import { DrawingSettingsDialog } from '@/pad-drawing/drawing-settings-dialog'
import {
    readDrawingThemePreference,
    resolveDrawingThemePreference,
    writeDrawingThemePreference,
    type DrawingThemePreference,
} from '@/pad-drawing/drawing-theme'
import { FileTransferProgress } from '@/pad-files/file-transfer-progress'
import { TreeDialog } from '@/pad-tree/tree-dialog'
import { FilesDialog } from '@/pad-files/files-dialog'
import { MarkdownEditorPane, type CursorPosition } from '@/pad-text/markdown-editor-pane'
import { MarkdownPreviewPane } from '@/pad-text/markdown-preview-pane'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { onCtrlKeyPressed } from '@/lib/events'
import { getRandomPhrase } from '@/components/feedback/loading-phrases'
import { formatFileSize } from '@/lib/file'
import { usePadPage, type ReadyPadPageState } from './use-pad-page'

const DrawingPane = lazy(() => import('@/pad-drawing/drawing-pane').then((mod) => ({ default: mod.DrawingPane })))

export function PadPage({ path }: { path: PadPath }) {
    const { resolvedTheme } = useTheme()
    const navigate = useNavigate()
    const [dialog, setDialog] = useState<DialogName>(null)
    const [layout, setLayout] = useState<'split' | 'editor' | 'preview'>('split')
    const [activeTab, setActiveTab] = useState<'text' | 'drawing' | 'files'>('text')
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [width, setWidth] = useState(window.innerWidth)
    const [phrase] = useState(getRandomPhrase)
    const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 })
    const [drawingThemePreference, setDrawingThemePreference] = useState<DrawingThemePreference>(readDrawingThemePreference)
    const drawingOpen = activeTab === 'drawing'
    const page = usePadPage(path, drawingOpen)
    const previewContent = useDeferredValue(page.kind === 'ready' ? page.text.content : '')
    const clockLabel = useClockLabel()
    const padName = padPathName(path)
    const drawingTheme = resolveDrawingThemePreference(drawingThemePreference, resolvedTheme)

    useEffect(() => { document.title = 'Mpad' }, [])
    useEffect(() => { writeDrawingThemePreference(drawingThemePreference) }, [drawingThemePreference])

    useEffect(() => {
        const onResize = () => setWidth(window.innerWidth)
        window.addEventListener('resize', onResize)
        const unsubs = [
            onCtrlKeyPressed('.', () => setDialog((v) => (v === 'tree' ? null : 'tree'))),
            onCtrlKeyPressed(';', () => setDialog((v) => (v === 'files' ? null : 'files'))),
            onCtrlKeyPressed('b', () => setSidebarOpen((v) => !v)),
        ]
        return () => { window.removeEventListener('resize', onResize); unsubs.forEach((fn) => fn()) }
    }, [])

    useEffect(() => {
        if (import.meta.env.VITE_E2E !== '1') return
        void import('@/test/window-state').then(({ publishWindowState }) => {
            publishWindowState({ page: page.kind === 'ready' ? page : null, openDrawing: () => setActiveTab('drawing') })
        })
    }, [page])

    const navigateToPad = (nextPath: PadPath) => { navigate({ to: '/$', params: { _splat: nextPath.slice(1) } }); setDialog(null) }

    const handleUploadFile = useCallback((file: File) => {
        if (page.kind !== 'ready') return
        try { page.uploadFile(file) } catch (error) { toast.error((error as Error).message) }
    }, [page])

    const topBar = (
        <div className="app-topbar">
            <div className="app-topbar-left">
                <button className="app-topbar-toggle" onClick={() => setSidebarOpen((v) => !v)} title="Toggle sidebar (Ctrl+B)">&#x2630;</button>
            </div>
            <div className="app-topbar-center">
                <a href="/" className="mpad-logo"><span className="mpad-logo-m">M</span>PAD</a>
            </div>
            <div className="app-topbar-right">
                <div className="pad-tabs">
                    <button className={`pad-tab${activeTab === 'text' ? ' active' : ''}`} onClick={() => setActiveTab('text')}>{padName}</button>
                    <button className={`pad-tab${activeTab === 'drawing' ? ' active' : ''}`} onClick={() => setActiveTab('drawing')}>Drawing</button>
                    <button className={`pad-tab${activeTab === 'files' ? ' active' : ''}`} onClick={() => setActiveTab('files')}>Files</button>
                </div>
                {activeTab === 'text' && (
                    <div className="pad-tab-actions">
                        <button className={`pad-tab-action${layout === 'split' ? ' active' : ''}`} onClick={() => setLayout('split')} title="Split view">&#x2637;</button>
                        <button className={`pad-tab-action${layout === 'editor' ? ' active' : ''}`} onClick={() => setLayout('editor')} title="Editor only">&#x270E;</button>
                        <button className={`pad-tab-action${layout === 'preview' ? ' active' : ''}`} onClick={() => setLayout('preview')} title="Preview only">&#x25C9;</button>
                    </div>
                )}
                {activeTab === 'drawing' && (
                    <div className="pad-tab-actions">
                        <button
                            className={`pad-tab-action${dialog === 'drawing-settings' ? ' active' : ''}`}
                            onClick={() => setDialog((value) => (value === 'drawing-settings' ? null : 'drawing-settings'))}
                            title="Drawing settings"
                            aria-label="Drawing settings"
                        >
                            <Settings2 className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )

    if (page.kind === 'loading') {
        return (
            <main className="app-shell" data-testid="pad-page">
                {topBar}
                <div className="app-content">
                    {sidebarOpen && <PadSidebar path={path} tree={[]} onNavigate={navigateToPad} />}
                    <div className="app-main">
                        <section className="loading-shell workspace-shell">
                            <div className="loading-card">
                                <span className="mpad-logo mpad-logo-lg"><span className="mpad-logo-m">M</span>PAD</span>
                                <p className="text-sm text-[--stone-text-secondary]">{phrase}</p>
                            </div>
                        </section>
                        <PadStatusBar path={path} connection="connecting" peerCount={0} clockLabel={clockLabel} cursorLabel={formatCursorLabel(cursor)} />
                    </div>
                </div>
            </main>
        )
    }

    const drawingRoom = page.drawing.kind === 'ready' ? page.drawing.room : null

    return (
        <main className="app-shell" data-testid="pad-page">
            {topBar}
            <div className="app-content">
                {sidebarOpen && <PadSidebar path={path} tree={page.tree} onNavigate={navigateToPad} />}
                <div className="app-main">
                    {activeTab === 'text' ? (
                        <PadWorkspace layout={layout} direction={width >= 1024 ? 'horizontal' : 'vertical'} textRoom={page.text.room} previewContent={previewContent} onCursorChange={setCursor} />
                    ) : activeTab === 'drawing' ? (
                        <section className="workspace-shell min-h-0" data-testid="workspace-shell">
                            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-[--stone-text-dim]">Loading…</div>}>
                                <DrawingPane room={drawingRoom} theme={drawingTheme} />
                            </Suspense>
                        </section>
                    ) : (
                        <FilesPane files={page.files} onUploadFile={handleUploadFile} onDownloadFile={page.downloadFile} onDeleteFile={(id) => { page.deleteFile(id); toast.success('Local file removed') }} />
                    )}
                    <PadStatusBar path={page.view.path} connection={page.view.connection} peerCount={page.view.peerCount} clockLabel={clockLabel} cursorLabel={formatCursorLabel(cursor)} />
                </div>
            </div>

            <TreeDialog open={dialog === 'tree'} onOpenChange={(open) => setDialog(open ? 'tree' : null)} path={page.view.path} tree={page.tree} onSelect={navigateToPad} />
            <FilesDialog open={dialog === 'files'} onOpenChange={(open) => setDialog(open ? 'files' : null)} path={page.view.path} files={page.files} onDelete={(id) => { page.deleteFile(id); toast.success('Local file removed') }} onDownload={page.downloadFile} />
            <DrawingSettingsDialog
                open={dialog === 'drawing-settings'}
                onOpenChange={(open) => setDialog(open ? 'drawing-settings' : null)}
                preference={drawingThemePreference}
                onPreferenceChange={setDrawingThemePreference}
            />
        </main>
    )
}

/* ---- Sidebar ---- */

function PadSidebar(input: {
    path: PadPath; tree: PadTreeItem[]
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
                <button className="pad-sidebar-help-btn" onClick={() => setHelpOpen(!helpOpen)} title="Markdown help">?</button>
                {helpOpen && (
                    <div className="pad-sidebar-help">
                        <div className="pad-sidebar-help-row"><code>#</code> Heading &nbsp; <code>**b**</code> Bold &nbsp; <code>*i*</code> Italic</div>
                        <div className="pad-sidebar-help-row"><code>- item</code> List &nbsp; <code>&gt;</code> Quote &nbsp; <code>`code`</code></div>
                        <div className="pad-sidebar-help-row"><code>[text](url)</code> Link &nbsp; <code>```</code> Code block</div>
                    </div>
                )}
            </div>
        </aside>
    )
}

/* ---- Files Pane ---- */

function FilesPane(input: {
    files: LiveFileState[]
    onUploadFile: (file: File) => void
    onDownloadFile: (file: LiveFileState) => void
    onDeleteFile: (id: string) => void
}) {
    const [dragging, setDragging] = useState(false)

    const handleDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true) }
    const handleDragLeave = () => setDragging(false)
    const handleDrop = (e: DragEvent) => {
        e.preventDefault(); setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) input.onUploadFile(file)
    }

    return (
        <section
            className={`files-pane workspace-shell min-h-0${dragging ? ' dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="workspace-shell"
        >
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
                            {file.isLocal && (
                                <button className="files-card-delete" onClick={(e) => { e.stopPropagation(); input.onDeleteFile(file.meta.id) }} title="Remove">&times;</button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="files-empty">Drop files to share</div>
            )}
        </section>
    )
}

/* ---- Status Bar ---- */

function PadStatusBar(input: { path: PadPath; connection: 'connecting' | 'connected' | 'disconnected'; peerCount: number; clockLabel: string; cursorLabel: string }) {
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

/* ---- Workspace ---- */

function PadWorkspace(input: { layout: 'split' | 'editor' | 'preview'; direction: 'horizontal' | 'vertical'; textRoom: ReadyPadPageState['text']['room']; previewContent: string; onCursorChange: (cursor: CursorPosition) => void }) {
    const editorPane = <Pane className="bg-[--stone-editor-bg]"><MarkdownEditorPane doc={input.textRoom.doc} awareness={input.textRoom.awareness} onCursorChange={input.onCursorChange} /></Pane>
    const previewPane = <Pane className="bg-[--stone-surface]"><div className="preview-scroll h-full overflow-y-auto px-10 py-8"><MarkdownPreviewPane content={input.previewContent} /></div></Pane>

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

function useClockLabel() {
    const [label, setLabel] = useState(readClockLabel)
    useEffect(() => { if (import.meta.env.VITE_E2E === '1') return; const id = window.setInterval(() => setLabel(readClockLabel()), 30_000); return () => window.clearInterval(id) }, [])
    return label
}

function readClockLabel() {
    if (import.meta.env.VITE_E2E === '1') return '03/29/26, 6:18 PM'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date())
}

function formatCursorLabel(cursor: CursorPosition) { return `Ln ${cursor.line}, Col ${cursor.column}` }
