import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable'
import { lazyWithPreload } from '@/lib/lazy-with-preload'
import { TextWorkspace } from '@/pad-text/view/text-workspace'
import type {
    PadWorkspaceFilesModel,
    PadWorkspaceModel,
    PadWorkspaceShellModel,
} from '@/pad-workspace/application/use-pad-workspace-model'
import { PadSidebar } from '@/workspace-shell/view/pad-sidebar'
import { PadStatusBar } from '@/workspace-shell/view/pad-status-bar'
import type { PadTreeItem } from '@mpad/protocol/pad-tree'
import type { ReactNode } from 'react'
import { Suspense } from 'react'

const LazyTextDiffWorkspace = lazyWithPreload(() =>
    import('@/pad-text/text-diff-workspace').then((mod) => ({
        default: mod.TextDiffWorkspace,
    })),
)
const LazyFilesPane = lazyWithPreload(() =>
    import('@/live-files/view/files-pane').then((mod) => ({
        default: mod.FilesPane,
    })),
)
const LazyDrawingWorkspacePane = lazyWithPreload(() =>
    import('@/pad-drawing/view/drawing-workspace-pane').then((mod) => ({
        default: mod.DrawingWorkspacePane,
    })),
)
const LazyWorkspaceDialogs = lazyWithPreload(() =>
    import('@/workspace-shell/view/workspace-dialogs').then((mod) => ({
        default: mod.WorkspaceDialogs,
    })),
)

export function preloadPadPagePanels() {
    void LazyTextDiffWorkspace.preload()
    void LazyFilesPane.preload()
    void LazyWorkspaceDialogs.preload()
}

export function PadPageDialogs(input: {
    shell: PadWorkspaceShellModel
    navigation: PadWorkspaceModel['navigation']
    files: PadWorkspaceFilesModel
}) {
    if (input.shell.view.dialog === null) return null

    return (
        <Suspense fallback={null}>
            <LazyWorkspaceDialogs
                shell={input.shell}
                navigation={input.navigation}
                files={input.files}
            />
        </Suspense>
    )
}

export function PadPageLoading(input: {
    shell: PadWorkspaceShellModel
    navigationItems: PadTreeItem[]
}) {
    return (
        <PadPageFrame
            shell={input.shell}
            navigationItems={input.navigationItems}
        >
            <section
                className='loading-shell workspace-shell'
                data-testid='workspace-shell'
            >
                <div className='loading-card'>
                    <span className='mpad-logo'>
                        Opening {input.shell.view.padName}
                    </span>
                </div>
            </section>
        </PadPageFrame>
    )
}

export function PadPageReady(input: {
    model: PadWorkspaceModel & {
        text: Extract<PadWorkspaceModel['text'], { kind: 'ready' }>
    }
    navigationItems: PadTreeItem[]
}) {
    const activePanel = readActivePanel(input.model)

    return (
        <PadPageFrame
            shell={input.model.shell}
            navigationItems={input.navigationItems}
        >
            {activePanel}
        </PadPageFrame>
    )
}

function readActivePanel(
    model: PadWorkspaceModel & {
        text: Extract<PadWorkspaceModel['text'], { kind: 'ready' }>
    },
) {
    const drawing =
        model.drawing.kind === 'ready' ? model.drawing.drawing : null

    switch (model.shell.view.activeTab) {
        case 'files':
            return (
                <Suspense fallback={<FilesPaneFallback />}>
                    <LazyFilesPane
                        files={model.files.files}
                        onDeleteFile={model.files.deleteFile}
                        onDownloadFile={model.files.downloadFile}
                        onUploadFile={model.files.uploadFile}
                    />
                </Suspense>
            )
        case 'diffs':
            return (
                <Suspense fallback={<DiffWorkspaceFallback />}>
                    <LazyTextDiffWorkspace
                        direction={model.shell.view.splitDirection}
                        model={model.history}
                    />
                </Suspense>
            )
        case 'drawing':
            return (
                <Suspense fallback={<DrawingWorkspaceFallback />}>
                    <LazyDrawingWorkspacePane
                        drawing={drawing}
                        theme={model.shell.view.drawingTheme}
                    />
                </Suspense>
            )
        case 'text':
            return (
                <TextWorkspace
                    content={model.text.content}
                    direction={model.shell.view.splitDirection}
                    editor={model.text.editor}
                    layout={model.shell.view.layout}
                    onCursorChange={model.shell.commands.setCursor}
                />
            )
    }
}

function PadPageFrame(input: {
    shell: PadWorkspaceShellModel
    navigationItems: PadTreeItem[]
    children: ReactNode
}) {
    const main = (
        <div className='app-main'>
            {input.children}
            <PadStatusBar
                path={input.shell.view.path}
                connection={input.shell.status.connection}
                peerCount={input.shell.status.peerCount}
                clockLabel={input.shell.view.clockLabel}
                cursorLabel={input.shell.view.cursorLabel}
            />
        </div>
    )

    if (!input.shell.view.sidebarOpen) {
        return <div className='app-content'>{main}</div>
    }

    return (
        <ResizablePanelGroup
            autoSaveId='pad-shell-sidebar'
            className='app-content'
            direction='horizontal'
        >
            <ResizablePanel
                className='flex min-h-0 flex-col'
                defaultSize={18}
                minSize={12}
                maxSize={28}
            >
                <PadSidebar
                    path={input.shell.view.path}
                    tree={input.navigationItems}
                    onNavigate={input.shell.commands.navigateToPad}
                />
            </ResizablePanel>
            <ResizableHandle className='bg-[--stone-border]' withHandle />
            <ResizablePanel className='flex min-h-0 flex-col' minSize={72}>
                {main}
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}

function DiffWorkspaceFallback() {
    return (
        <section
            className='workspace-shell min-h-0'
            data-testid='text-diff-workspace'
        >
            <div className='flex h-full items-center justify-center bg-[--stone-bg] text-sm text-[--stone-text-muted]'>
                Loading diff…
            </div>
        </section>
    )
}

function FilesPaneFallback() {
    return (
        <section className='workspace-shell min-h-0'>
            <div className='flex h-full items-center justify-center bg-[--stone-bg] text-sm text-[--stone-text-muted]'>
                Loading files…
            </div>
        </section>
    )
}

function DrawingWorkspaceFallback() {
    return (
        <section
            className='workspace-shell min-h-0'
            data-testid='drawing-workspace'
        >
            <div className='flex h-full items-center justify-center bg-[--stone-bg] text-sm text-[--stone-text-muted]'>
                Loading drawing…
            </div>
        </section>
    )
}
