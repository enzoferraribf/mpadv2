import type { DrawingHandle } from '@/pad-drawing/infrastructure/drawing-handle'
import { DrawingPane } from './drawing-pane'
import type { DrawingTheme } from './drawing-theme'

export function DrawingWorkspace(input: {
    drawing: DrawingHandle | null
    theme: DrawingTheme
}) {
    return (
        <div
            className='h-full min-h-0 bg-[--stone-editor-bg]'
            data-testid='drawing-workspace'
        >
            <DrawingPane drawing={input.drawing} theme={input.theme} />
        </div>
    )
}
