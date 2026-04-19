import { padPathName, type PadPath } from '@mpad/core/pad-path'
import { getRandomPhrase } from '@/components/feedback/loading-phrases'
import type { PadWorkspaceLayout, PadWorkspaceTab } from '@/pad-workspace/domain/workspace-view'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { PadSidebar } from '@/workspace-shell/view/pad-sidebar'
import { PadStatusBar } from '@/workspace-shell/view/pad-status-bar'

type PadLoadingShellProps = {
    activeTab?: PadWorkspaceTab
    clockLabel?: string
    connection?: 'connecting' | 'connected' | 'disconnected'
    cursorLabel?: string
    layout?: PadWorkspaceLayout
    onNavigate?: (path: PadPath) => void
    onOpenTab?: (tab: PadWorkspaceTab) => void
    onSetLayout?: (layout: PadWorkspaceLayout) => void
    onToggleSidebar?: () => void
    path: PadPath
    peerCount?: number
    phrase?: string
    sidebarOpen?: boolean
}

const noop = () => {}
const noopNavigate = (_path: PadPath) => {}

export function PadLoadingShell(input: PadLoadingShellProps) {
    const padName = padPathName(input.path)
    const main = (
        <div className="app-main">
            <section className="loading-shell workspace-shell">
                <div className="loading-card">
                    <span className="mpad-logo mpad-logo-lg"><span className="mpad-logo-m">M</span>PAD</span>
                    <p className="text-sm text-[--stone-text-secondary]">{input.phrase ?? getRandomPhrase()}</p>
                </div>
            </section>
            <PadStatusBar
                path={input.path}
                connection={input.connection ?? 'connecting'}
                peerCount={input.peerCount ?? 0}
                clockLabel={input.clockLabel ?? readClockLabel()}
                cursorLabel={input.cursorLabel ?? 'Ln 1, Col 1'}
            />
        </div>
    )

    return (
        <>
            <div className="app-topbar">
                <div className="app-topbar-left">
                    <button
                        className="app-topbar-toggle"
                        onClick={input.onToggleSidebar ?? noop}
                        title="Toggle sidebar (Ctrl+B)"
                        type="button"
                    >
                        &#x2630;
                    </button>
                </div>
                <div className="app-topbar-center">
                    <a href="/" className="mpad-logo"><span className="mpad-logo-m">M</span>PAD</a>
                </div>
                <div className="app-topbar-right">
                    <div className="pad-tabs">
                        <button
                            className={`pad-tab${(input.activeTab ?? 'text') === 'text' ? ' active' : ''}`}
                            onClick={() => (input.onOpenTab ?? noop)('text')}
                            type="button"
                        >
                            {padName}
                        </button>
                        <button
                            className={`pad-tab${input.activeTab === 'diffs' ? ' active' : ''}`}
                            onClick={() => (input.onOpenTab ?? noop)('diffs')}
                            type="button"
                        >
                            Diffs
                        </button>
                        <button
                            className={`pad-tab${input.activeTab === 'drawing' ? ' active' : ''}`}
                            onClick={() => (input.onOpenTab ?? noop)('drawing')}
                            type="button"
                        >
                            Drawing
                        </button>
                        <button
                            className={`pad-tab${input.activeTab === 'files' ? ' active' : ''}`}
                            onClick={() => (input.onOpenTab ?? noop)('files')}
                            type="button"
                        >
                            Files
                        </button>
                    </div>
                    {(input.activeTab ?? 'text') === 'text' ? (
                        <div className="pad-tab-actions">
                            <button
                                className={`pad-tab-action${(input.layout ?? 'editor') === 'split' ? ' active' : ''}`}
                                onClick={() => (input.onSetLayout ?? noop)('split')}
                                title="Split view"
                                type="button"
                            >
                                &#x2637;
                            </button>
                            <button
                                className={`pad-tab-action${(input.layout ?? 'editor') === 'editor' ? ' active' : ''}`}
                                onClick={() => (input.onSetLayout ?? noop)('editor')}
                                title="Editor only"
                                type="button"
                            >
                                &#x270E;
                            </button>
                            <button
                                className={`pad-tab-action${input.layout === 'preview' ? ' active' : ''}`}
                                onClick={() => (input.onSetLayout ?? noop)('preview')}
                                title="Preview only"
                                type="button"
                            >
                                &#x25C9;
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
            {readSidebarOpen(input.sidebarOpen) ? (
                <ResizablePanelGroup autoSaveId="pad-shell-sidebar" className="app-content" direction="horizontal">
                    <ResizablePanel defaultSize={18} minSize={12} maxSize={28}>
                        <PadSidebar
                            path={input.path}
                            tree={[]}
                            onNavigate={input.onNavigate ?? noopNavigate}
                        />
                    </ResizablePanel>
                    <ResizableHandle className="bg-[--stone-border]" withHandle />
                    <ResizablePanel minSize={72}>
                        {main}
                    </ResizablePanel>
                </ResizablePanelGroup>
            ) : (
                <div className="app-content">
                    {main}
                </div>
            )}
        </>
    )
}

function readSidebarOpen(sidebarOpen: boolean | undefined) {
    if (sidebarOpen !== undefined) return sidebarOpen
    return false
}

function readClockLabel() {
    if (import.meta.env.VITE_E2E === '1') return '03/29/26, 6:18 PM'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date())
}
