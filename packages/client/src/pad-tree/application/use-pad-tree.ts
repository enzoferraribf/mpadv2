import type { PadPath, PadTreeItem } from '@mmpad/shared'
import { useEffect, useState } from 'react'
import { fetchPadTree } from '@/pad-session/api'

export type PadTreeModel =
    | { kind: 'loading' }
    | { kind: 'ready'; items: PadTreeItem[] }

export function usePadTree(path: PadPath): PadTreeModel {
    const [state, setState] = useState<PadTreeModel>({ kind: 'loading' })

    useEffect(() => {
        const controller = new AbortController()
        setState({ kind: 'loading' })

        void fetchPadTree(path, controller.signal)
            .then((items) => setState({ kind: 'ready', items }))
            .catch((error: Error) => {
                if (error.name === 'AbortError') return
                throw error
            })

        return () => controller.abort()
    }, [path])

    return state
}
