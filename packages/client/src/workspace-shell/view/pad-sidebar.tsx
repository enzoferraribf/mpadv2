import { padPathName, type PadPath } from '@mpad/core/pad-path'
import type { PadTreeItem } from '@mpad/protocol/pad-tree'
import { useState } from 'react'

export function PadSidebar(input: {
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
