import { usePadPageController } from '@/features/workspace/application/controller'
import {
    PadPageDialogs,
    PadPageLoading,
    PadPageReady,
    preloadPadPagePanels,
} from '@/features/workspace/view/shell'
import { PadTopBar } from '@/features/workspace/view/top-bar'
import { scheduleIdleTask } from '@/shared/lib/schedule-idle'
import type { PadPath } from '@mpad/core/pad-path'
import type { PadTreeItem } from '@mpad/protocol/pad-tree'
import { useEffect, useRef } from 'react'

export function PadPage({ path }: { path: PadPath }) {
    const model = usePadPageController(path)
    const prefetchedRef = useRef(false)
    const lastReadyNavigationRef = useRef<PadTreeItem[] | null>(null)

    if (model.navigation.kind === 'ready') {
        lastReadyNavigationRef.current = model.navigation.items
    }

    useEffect(() => {
        if (import.meta.env.VITE_E2E !== '1') return
        let active = true
        void import('@/shared/test/window-state').then(
            ({ publishWindowState }) => {
                if (!active) return
                publishWindowState(model)
            },
        )
        return () => {
            active = false
        }
    }, [model])

    useEffect(() => {
        if (prefetchedRef.current || model.shell.view.activeTab !== 'text')
            return

        return scheduleIdleTask(() => {
            prefetchedRef.current = true
            preloadPadPagePanels()
        }, 600)
    }, [model.shell.view.activeTab])
    const navigationItems =
        model.navigation.kind === 'ready'
            ? model.navigation.items
            : (lastReadyNavigationRef.current ?? [])

    return (
        <main className='app-shell' data-testid='pad-page'>
            <PadTopBar shell={model.shell} />
            {model.text.kind === 'ready' ? (
                <PadPageReady
                    model={{
                        ...model,
                        text: model.text,
                    }}
                    navigationItems={navigationItems}
                />
            ) : (
                <PadPageLoading
                    shell={model.shell}
                    navigationItems={navigationItems}
                />
            )}
            <PadPageDialogs
                shell={model.shell}
                navigation={model.navigation}
                files={model.files}
            />
        </main>
    )
}
