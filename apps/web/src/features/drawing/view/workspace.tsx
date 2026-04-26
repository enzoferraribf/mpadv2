import type { DrawingHandle } from '@/features/drawing/application/handle'
import type { DrawingTheme } from '../domain/theme'
import { DrawingPane } from './pane'

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
