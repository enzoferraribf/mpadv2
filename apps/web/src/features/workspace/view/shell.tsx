import type {
    PadWorkspaceModel,
    PadWorkspaceShellModel,
} from '@/features/workspace/application/controller'
import {
    DialogFallback,
    DrawingWorkspaceFallback,
    TextWorkspaceFallback,
} from '@/features/workspace/view/fallbacks'
import { PadSidebar } from '@/features/workspace/view/sidebar'
import { PadStatusBar } from '@/features/workspace/view/status-bar'
import { lazyWithPreload } from '@/shared/lib/lazy-with-preload'
import { OpeningLoader } from '@/shared/ui/feedback/opening-loader'
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/shared/ui/resizable'
import type { PadTreeItem } from '@mpad/protocol/pad-tree'
import type { ReactNode } from 'react'
import { Suspense, lazy } from 'react'

const LazyTextWorkspace = lazy(() =>
    import('@/features/text/view/workspace').then((mod) => ({
        default: mod.TextWorkspace,
    })),
)

const LazyDrawingWorkspacePane = lazyWithPreload(() =>
    import('@/features/drawing').then((mod) => ({
        default: mod.DrawingWorkspacePane,
    })),
)
const LazyWorkspaceDialogs = lazyWithPreload(() =>
    import('@/features/workspace/view/dialogs').then((mod) => ({
        default: mod.WorkspaceDialogs,
    })),
)

export function preloadPadPagePanels() {
    void LazyWorkspaceDialogs.preload()
}

export function PadPageDialogs(input: {
    shell: PadWorkspaceShellModel
    navigation: PadWorkspaceModel['navigation']
}) {
    if (input.shell.view.dialog === null) return null

    return (
        <Suspense fallback={<DialogFallback />}>
            <LazyWorkspaceDialogs
                shell={input.shell}
                navigation={input.navigation}
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
                <OpeningLoader label={input.shell.view.padName} />
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
                <Suspense fallback={<TextWorkspaceFallback />}>
                    <LazyTextWorkspace
                        direction={model.shell.view.splitDirection}
                        editor={model.text.editor}
                        layout={model.shell.view.layout}
                        onCursorChange={model.shell.commands.setCursor}
                    />
                </Suspense>
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
                connectionError={input.shell.status.connectionError}
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
