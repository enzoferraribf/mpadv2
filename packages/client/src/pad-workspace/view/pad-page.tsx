import type { PadPath } from '@mpad/core/pad-path'
import { Suspense, useEffect, useRef } from 'react'
import { PadLoadingShell } from '@/pad-workspace/view/pad-loading-shell'
import { usePadPageController, type PadPageController } from '@/pad-workspace/application/use-pad-page-controller'
import { TextWorkspace } from '@/pad-text/view/text-workspace'
import { lazyWithPreload } from '@/lib/lazy-with-preload'
import { scheduleIdleTask } from '@/lib/schedule-idle'
import { PadSidebar } from '@/workspace-shell/view/pad-sidebar'
import { PadStatusBar } from '@/workspace-shell/view/pad-status-bar'
import { PadTopBar } from '@/workspace-shell/view/pad-top-bar'

const LazyTextDiffWorkspace = lazyWithPreload(() =>
    import('@/pad-text/text-diff-workspace').then((mod) => ({ default: mod.TextDiffWorkspace })),
)
const LazyFilesPane = lazyWithPreload(() =>
    import('@/live-files/view/files-pane').then((mod) => ({ default: mod.FilesPane })),
)
const LazyDrawingWorkspacePane = lazyWithPreload(() =>
    import('@/pad-drawing/view/drawing-workspace-pane').then((mod) => ({ default: mod.DrawingWorkspacePane })),
)
const LazyWorkspaceDialogs = lazyWithPreload(() =>
    import('@/workspace-shell/view/workspace-dialogs').then((mod) => ({ default: mod.WorkspaceDialogs })),
)

export function PadPage({ path }: { path: PadPath }) {
    const model = usePadPageController(path)
    const prefetchedRef = useRef(false)

    useEffect(() => {
        if (import.meta.env.VITE_E2E !== '1') return
        let active = true
        void import('@/test/window-state').then(({ publishWindowState }) => {
            if (!active) return
            publishWindowState(model)
        })
        return () => {
            active = false
        }
    }, [model])

    useEffect(() => {
        if (prefetchedRef.current || model.state.view.activeTab !== 'text') return

        return scheduleIdleTask(() => {
            prefetchedRef.current = true
            void LazyTextDiffWorkspace.preload()
            void LazyFilesPane.preload()
            void LazyWorkspaceDialogs.preload()
        }, 600)
    }, [model.state.view.activeTab])

    const dialogs = model.state.view.dialog !== null ? (
        <Suspense fallback={null}>
            <LazyWorkspaceDialogs model={model} />
        </Suspense>
    ) : null

    if (model.state.kind === 'loading') {
        return (
            <main className="app-shell" data-testid="pad-page">
                <PadLoadingShell
                    activeTab={model.state.view.activeTab}
                    clockLabel={model.state.view.clockLabel}
                    cursorLabel={model.state.view.cursorLabel}
                    layout={model.state.view.layout}
                    onNavigate={model.commands.navigateToPad}
                    onOpenTab={model.commands.openTab}
                    onSetLayout={model.commands.setLayout}
                    onToggleSidebar={model.commands.toggleSidebar}
                    path={path}
                    phrase={model.state.view.phrase}
                    sidebarOpen={model.state.view.sidebarOpen}
                />
                {dialogs}
            </main>
        )
    }

    const readyModel: PadPageController & {
        state: Extract<PadPageController['state'], { kind: 'ready' }>
    } = {
        ...model,
        state: model.state,
    }

    return (
        <main className="app-shell" data-testid="pad-page">
            <PadTopBar model={model} />
            <ReadyPadPage model={readyModel} />
            {dialogs}
        </main>
    )
}

function ReadyPadPage(input: {
    model: PadPageController & { state: Extract<PadPageController['state'], { kind: 'ready' }> }
}) {
    const { commands, state } = input.model
    const drawing = state.drawing.kind === 'ready' ? state.drawing.drawing : null

    return (
        <div className="app-content">
            {state.view.sidebarOpen ? (
                <PadSidebar
                    path={state.view.path}
                    tree={state.status.tree}
                    onNavigate={commands.navigateToPad}
                />
            ) : null}
            <div className="app-main">
                {state.view.activeTab === 'files' ? (
                    <Suspense fallback={<FilesPaneFallback />}>
                        <LazyFilesPane
                            files={state.status.files}
                            onDeleteFile={commands.deleteFile}
                            onDownloadFile={commands.downloadFile}
                            onUploadFile={commands.uploadFile}
                        />
                    </Suspense>
                ) : state.view.activeTab === 'diffs' ? (
                    <Suspense fallback={<DiffWorkspaceFallback />}>
                        <LazyTextDiffWorkspace
                            currentContent={state.text.content}
                            direction={state.view.splitDirection}
                            onRevertToRevision={commands.revertTextToRevision}
                            path={state.view.path}
                        />
                    </Suspense>
                ) : state.view.activeTab === 'drawing' ? (
                    <Suspense fallback={<DrawingWorkspaceFallback />}>
                        <LazyDrawingWorkspacePane drawing={drawing} theme={state.view.drawingTheme} />
                    </Suspense>
                ) : (
                    <TextWorkspace
                        comments={state.text.comments}
                        content={state.text.content}
                        direction={state.view.splitDirection}
                        editor={state.text.editor}
                        layout={state.view.layout}
                        onCloseCommentOverlay={commands.closeCommentOverlay}
                        onCommentCreate={commands.createCommentThread}
                        onCommentDeleteMessage={commands.deleteCommentMessage}
                        onCommentDeleteThread={commands.deleteCommentThread}
                        onCommentEditMessage={commands.editCommentMessage}
                        onCommentOpenThread={commands.openCommentThread}
                        onCommentReopen={commands.reopenCommentThread}
                        onCommentReply={commands.replyToCommentThread}
                        onCommentResolve={commands.resolveCommentThread}
                        onCommentStartDraft={commands.openCommentDraftFromSelection}
                        onCursorChange={commands.setCursor}
                        onEditorSelectionChange={commands.setCommentSelection}
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

function DiffWorkspaceFallback() {
    return (
        <section className="workspace-shell min-h-0" data-testid="text-diff-workspace">
            <div className="flex h-full items-center justify-center bg-[--stone-bg] text-sm text-[--stone-text-muted]">
                Loading diff…
            </div>
        </section>
    )
}

function FilesPaneFallback() {
    return (
        <section className="workspace-shell min-h-0">
            <div className="flex h-full items-center justify-center bg-[--stone-bg] text-sm text-[--stone-text-muted]">
                Loading files…
            </div>
        </section>
    )
}

function DrawingWorkspaceFallback() {
    return (
        <section className="workspace-shell min-h-0" data-testid="drawing-workspace">
            <div className="flex h-full items-center justify-center bg-[--stone-bg] text-sm text-[--stone-text-muted]">
                Loading drawing…
            </div>
        </section>
    )
}
