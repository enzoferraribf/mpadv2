import type { PadPath } from '@mmpad/shared'
import { useEffect } from 'react'
import { TextDiffWorkspace } from '@/pad-text/text-diff-workspace'
import { DrawingWorkspacePane } from '@/pad-doc/view/drawing-workspace-pane'
import { TextWorkspace } from '@/pad-doc/view/text-workspace'
import { FilesPane } from '@/file-session/view/files-pane'
import { usePadPageModel, type PadPageModel } from '@/workspace-shell/model/use-pad-page-model'
import { PadSidebar } from '@/workspace-shell/view/pad-sidebar'
import { PadStatusBar } from '@/workspace-shell/view/pad-status-bar'
import { PadTopBar } from '@/workspace-shell/view/pad-top-bar'
import { WorkspaceDialogs } from '@/workspace-shell/view/workspace-dialogs'

export function PadPage({ path }: { path: PadPath }) {
    const model = usePadPageModel(path)

    useEffect(() => {
        if (import.meta.env.VITE_E2E !== '1') return
        void import('@/test/window-state').then(({ publishWindowState }) => {
            publishWindowState(model)
        })
    }, [model])

    if (model.state.kind === 'loading') {
        return (
            <main className="app-shell" data-testid="pad-page">
                <PadTopBar model={model} />
                <LoadingPadPage path={path} model={model} />
                <WorkspaceDialogs model={model} />
            </main>
        )
    }

    const readyModel: PadPageModel & {
        state: Extract<PadPageModel['state'], { kind: 'ready' }>
    } = {
        ...model,
        state: model.state,
    }

    return (
        <main className="app-shell" data-testid="pad-page">
            <PadTopBar model={model} />
            <ReadyPadPage model={readyModel} />
            <WorkspaceDialogs model={model} />
        </main>
    )
}

function LoadingPadPage(input: { path: PadPath; model: ReturnType<typeof usePadPageModel> }) {
    const { actions, state } = input.model

    return (
        <div className="app-content">
            {state.view.sidebarOpen ? (
                <PadSidebar
                    path={input.path}
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

function ReadyPadPage(input: { model: PadPageModel & { state: Extract<PadPageModel['state'], { kind: 'ready' }> } }) {
    const { actions, state } = input.model
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
                ) : state.view.activeTab === 'diffs' ? (
                    <TextDiffWorkspace
                        currentContent={state.text.content}
                        direction={state.view.splitDirection}
                        path={state.view.path}
                    />
                ) : state.view.activeTab === 'drawing' ? (
                    <DrawingWorkspacePane drawing={drawing} theme={state.view.drawingTheme} />
                ) : (
                    <TextWorkspace
                        comments={state.text.comments}
                        content={state.text.content}
                        direction={state.view.splitDirection}
                        editor={state.text.editor}
                        layout={state.view.layout}
                        onCloseCommentOverlay={actions.closeCommentOverlay}
                        onCommentCreate={actions.createCommentThread}
                        onCommentDeleteMessage={actions.deleteCommentMessage}
                        onCommentDeleteThread={actions.deleteCommentThread}
                        onCommentEditMessage={actions.editCommentMessage}
                        onCommentOpenThread={actions.openCommentThread}
                        onCommentReopen={actions.reopenCommentThread}
                        onCommentReply={actions.replyToCommentThread}
                        onCommentResolve={actions.resolveCommentThread}
                        onCommentStartDraft={actions.openCommentDraftFromSelection}
                        onCursorChange={actions.setCursor}
                        onEditorSelectionChange={actions.setCommentSelection}
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
