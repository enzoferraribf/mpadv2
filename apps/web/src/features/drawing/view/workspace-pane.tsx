import type { DrawingHandle } from '@/features/drawing/application/handle'
import type { DrawingTheme } from '@/features/drawing/domain/theme'
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
        <div
            className='flex h-full items-center justify-center text-sm text-[--stone-text-dim]'
            data-testid='drawing-workspace'
        >
            Loading drawing…
        </div>
    )
}
