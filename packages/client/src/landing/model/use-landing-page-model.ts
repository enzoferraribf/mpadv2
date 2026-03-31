import { padPath, type PadPath } from '@mmpad/shared'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export type LandingPageModel = {
    host: string
    openPad: (name: string) => void
}

export function useLandingPageModel(): LandingPageModel {
    const navigate = useNavigate()

    useEffect(() => {
        document.title = 'MPAD'
    }, [])

    return {
        host: window.location.host,
        openPad(name) {
            const path = readLandingPadPath(name)
            if (!path) return

            navigate({ to: '/$', params: { _splat: path.slice(1) } })
        },
    }
}

function readLandingPadPath(value: string): PadPath | null {
    const name = value.trim()
    if (name === '') return null
    return padPath(name)
}
