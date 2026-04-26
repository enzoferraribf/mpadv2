import { Toaster } from '@/shared/ui/sonner'
import type { PadPath } from '@mpad/core/pad-path'
import { Suspense, createElement, lazy } from 'react'
import { LandingPage } from './landing/page'
import { PadRouteFallback } from './view/fallbacks'

const LazyPadPage = lazy(() =>
    import('./view/page').then((mod) => ({
        default: mod.PadPage,
    })),
)

export { LandingPage, Toaster }

export function PadPage(props: { path: PadPath }) {
    return createElement(
        Suspense,
        { fallback: createElement(PadRouteFallback, { path: props.path }) },
        createElement(LazyPadPage, props),
    )
}
