import { type PadPath, padPath } from '@mpad/core/pad-path'
import { useNavigate } from '@tanstack/react-router'

export type LandingPageModel = {
    host: string
    openPad: (name: string) => void
}

export function useLandingPageModel(): LandingPageModel {
    const navigate = useNavigate()

    return {
        host: readLandingHost(),
        openPad(name) {
            const path = readLandingPadPath(name)
            if (!path) return

            navigate({ to: '/$', params: { _splat: path.slice(1) } })
        },
    }
}

function readLandingHost() {
    if (
        import.meta.env.VITE_E2E === '1' &&
        typeof window.__MPAD_TEST_HOST__ === 'string'
    ) {
        return window.__MPAD_TEST_HOST__
    }

    return window.location.host
}

function readLandingPadPath(value: string): PadPath | null {
    const name = value.trim()
    if (name === '') return null
    return padPath(name)
}
