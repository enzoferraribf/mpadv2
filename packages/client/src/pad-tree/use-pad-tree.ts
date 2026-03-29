import type { PadPath } from '@mmpad/shared'
import { useEffect, useState } from 'react'
import { fetchPadTree } from '@/pad-session/api'

export function usePadTree(path: PadPath) {
    const [tree, setTree] = useState<null | Awaited<ReturnType<typeof fetchPadTree>>>(null)

    useEffect(() => {
        const controller = new AbortController()
        setTree(null)
        void fetchPadTree(path, controller.signal)
            .then(setTree)
            .catch((error: Error) => {
                if (error.name === 'AbortError') return
                throw error
            })
        return () => controller.abort()
    }, [path])

    return tree
}
