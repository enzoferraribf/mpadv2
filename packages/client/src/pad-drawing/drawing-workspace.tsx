import type { DrawingHandle } from '@/pad-drawing/infrastructure/drawing-handle'
import type { DrawingTheme } from './drawing-theme'
import { DrawingPane } from './drawing-pane'

export function DrawingWorkspace(input: {
    drawing: DrawingHandle | null
    theme: DrawingTheme
}) {
    return (
        <div className="h-full min-h-0 bg-[--stone-editor-bg]" data-testid="drawing-workspace">
            <DrawingPane drawing={input.drawing} theme={input.theme} />
        </div>
    )
}
