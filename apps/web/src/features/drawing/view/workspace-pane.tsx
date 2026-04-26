import type { DrawingHandle } from '@/features/drawing/application/handle'
import type { DrawingTheme } from '@/features/drawing/domain/theme'
import { OpeningLoader } from '@/shared/ui/feedback/opening-loader'
import { Suspense, lazy } from 'react'

const LazyDrawingWorkspace = lazy(() =>
    import('@/features/drawing/view/workspace').then((mod) => ({
        default: mod.DrawingWorkspace,
    })),
)

export function DrawingWorkspacePane(input: {
    drawing: DrawingHandle | null
    theme: DrawingTheme
}) {
    return (
        <section
            className='workspace-shell min-h-0'
            data-testid='workspace-shell'
        >
            <section className='h-full min-h-0 overflow-hidden bg-[--stone-editor-bg]'>
                <Suspense fallback={<DrawingWorkspaceFallback />}>
                    <LazyDrawingWorkspace
                        drawing={input.drawing}
                        theme={input.theme}
                    />
                </Suspense>
            </section>
        </section>
    )
}

function DrawingWorkspaceFallback() {
    return (
        <div className='loading-shell h-full' data-testid='drawing-workspace'>
            <OpeningLoader label='Excalidraw' />
        </div>
    )
}
