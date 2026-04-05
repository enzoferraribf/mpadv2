import { Settings2 } from 'lucide-react'
import type { PadWorkspaceModel } from '@/pad-workspace/application/use-pad-workspace-model'

export function PadTopBar(input: { model: PadWorkspaceModel }) {
    const { commands, state } = input.model

    return (
        <div className="app-topbar">
            <div className="app-topbar-left">
                <button className="app-topbar-toggle" onClick={commands.toggleSidebar} title="Toggle sidebar (Ctrl+B)">&#x2630;</button>
            </div>
            <div className="app-topbar-center">
                <a href="/" className="mpad-logo"><span className="mpad-logo-m">M</span>PAD</a>
            </div>
            <div className="app-topbar-right">
                <div className="pad-tabs">
                    <button className={`pad-tab${state.view.activeTab === 'text' ? ' active' : ''}`} onClick={() => commands.openTab('text')}>{state.view.padName}</button>
                    <button className={`pad-tab${state.view.activeTab === 'diffs' ? ' active' : ''}`} onClick={() => commands.openTab('diffs')}>Diffs</button>
                    <button className={`pad-tab${state.view.activeTab === 'drawing' ? ' active' : ''}`} onClick={() => commands.openTab('drawing')}>Drawing</button>
                    <button className={`pad-tab${state.view.activeTab === 'files' ? ' active' : ''}`} onClick={() => commands.openTab('files')}>Files</button>
                </div>
                {state.view.activeTab === 'text' ? (
                    <div className="pad-tab-actions">
                        <button className={`pad-tab-action${state.view.layout === 'split' ? ' active' : ''}`} onClick={() => commands.setLayout('split')} title="Split view">&#x2637;</button>
                        <button className={`pad-tab-action${state.view.layout === 'editor' ? ' active' : ''}`} onClick={() => commands.setLayout('editor')} title="Editor only">&#x270E;</button>
                        <button className={`pad-tab-action${state.view.layout === 'preview' ? ' active' : ''}`} onClick={() => commands.setLayout('preview')} title="Preview only">&#x25C9;</button>
                    </div>
                ) : null}
                {state.view.activeTab === 'drawing' ? (
                    <div className="pad-tab-actions">
                        <button
                            className={`pad-tab-action${state.view.dialog === 'drawing-settings' ? ' active' : ''}`}
                            onClick={() => commands.toggleDialog('drawing-settings')}
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
