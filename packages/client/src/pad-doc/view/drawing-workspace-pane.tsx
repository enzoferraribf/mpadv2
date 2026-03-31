import { lazy, Suspense } from 'react'
import type { DrawingHandle } from '@/pad-drawing/drawing-handle'
import type { DrawingTheme } from '@/pad-drawing/drawing-theme'

const LazyDrawingWorkspace = lazy(() => import('@/pad-drawing/drawing-workspace').then((mod) => ({ default: mod.DrawingWorkspace })))

export function DrawingWorkspacePane(input: {
    drawing: DrawingHandle | null
    theme: DrawingTheme
}) {
    return (
        <section className="workspace-shell min-h-0" data-testid="workspace-shell">
            <section className="h-full min-h-0 overflow-hidden bg-[--stone-editor-bg]">
                <Suspense fallback={<DrawingWorkspaceFallback />}>
                    <LazyDrawingWorkspace drawing={input.drawing} theme={input.theme} />
                </Suspense>
            </section>
        </section>
    )
}

function DrawingWorkspaceFallback() {
    return (
        <div className="flex h-full items-center justify-center text-sm text-[--stone-text-dim]" data-testid="drawing-workspace">
            Loading drawing…
        </div>
    )
}
