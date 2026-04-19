import { PadLoadingShell } from '@/pad-workspace/view/pad-loading-shell'
import { padPath } from '@mpad/core/pad-path'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const LazyPadPage = lazy(() =>
    import('@/pad-workspace/view/pad-page').then((mod) => ({
        default: mod.PadPage,
    })),
)

export const Route = createFileRoute('/$')({
    component: PadRoute,
})

function PadRoute() {
    const { _splat } = Route.useParams()
    const path = padPath(_splat ?? '')

    return (
        <Suspense
            fallback={
                <main className='app-shell' data-testid='pad-page'>
                    <PadLoadingShell path={path} />
                </main>
            }
        >
            <LazyPadPage path={path} />
        </Suspense>
    )
}
