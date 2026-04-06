import type { PadPath, PadTreeItem } from '@mpad/shared'
import { useEffect, useState } from 'react'
import { browserWorkspaceNavigationQuery } from '@/pad-workspace/infrastructure/browser-navigation-query'

export type WorkspaceNavigationModel =
    | { kind: 'loading' }
    | { kind: 'ready'; items: PadTreeItem[] }

export function useWorkspaceNavigation(path: PadPath): WorkspaceNavigationModel {
    const [state, setState] = useState<WorkspaceNavigationModel>({ kind: 'loading' })

    useEffect(() => {
        const controller = new AbortController()
        setState({ kind: 'loading' })

        void browserWorkspaceNavigationQuery.listRelatedPads(path, controller.signal)
            .then((items) => setState({ kind: 'ready', items }))
            .catch((error: Error) => {
                if (error.name === 'AbortError') return
                throw error
            })

        return () => controller.abort()
    }, [path])

    return state
}
