import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import '@excalidraw/excalidraw/index.css'
import type { DrawingHandle } from '@/features/drawing/application/handle'
import {
    type FlushPlan,
    readChangeFlushPlan,
    readPointerUpFlushPlan,
    sameElements,
    useDrawingState,
} from '../application/pane-controller'
import type { DrawingTheme } from '../domain/theme'

const ExcalidrawEditor = lazy(() =>
    import('@excalidraw/excalidraw').then((mod) => ({
        default: mod.Excalidraw,
    })),
)

declare global {
    interface Window {
        __mpadDrawingApi__?: ExcalidrawImperativeAPI | null
    }
}

export function DrawingPane(input: {
    drawing: DrawingHandle | null
    theme: DrawingTheme
}) {
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
    const localOriginRef = useRef({})
    const { collaborators, elements } = useDrawingState(
        input.drawing,
        localOriginRef.current,
    )
    const applyingRemoteRef = useRef(false)
    const pointerActiveRef = useRef(false)
    const pendingElementsRef = useRef<readonly ExcalidrawElement[] | null>(null)
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    function clearFlushTimer() {
        if (!flushTimerRef.current) return
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
    }

    function getCurrentElements() {
        return (
            pendingElementsRef.current ??
            api?.getSceneElementsIncludingDeleted()
        )
    }

    function flushScene(drawing: DrawingHandle) {
        clearFlushTimer()
        const nextElements = getCurrentElements()
        if (!nextElements) return
        pendingElementsRef.current = nextElements
        drawing.writeScene(nextElements, localOriginRef.current)
    }

    function scheduleFlush(drawing: DrawingHandle, delayMs: number) {
        clearFlushTimer()
        flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null
            flushScene(drawing)
        }, delayMs)
    }

    function scheduleLiveFlush(drawing: DrawingHandle, delayMs: number) {
        if (flushTimerRef.current) return
        flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null
            flushScene(drawing)
        }, delayMs)
    }

    function applyFlushPlan(drawing: DrawingHandle, plan: FlushPlan) {
        switch (plan.kind) {
            case 'live':
                scheduleLiveFlush(drawing, plan.delayMs)
                return
            case 'scheduled':
                scheduleFlush(drawing, plan.delayMs)
                return
            case 'immediate':
                flushScene(drawing)
                return
        }
    }

    useEffect(() => {
        if (!api) return
        pendingElementsRef.current = elements
        applyingRemoteRef.current = true
        api.updateScene({
            elements,
        })
        queueMicrotask(() => {
            applyingRemoteRef.current = false
        })
    }, [api, elements])

    useEffect(() => {
        if (!api) return
        api.updateScene({
            appState: {
                collaborators,
                theme: input.theme,
            },
        })
    }, [api, collaborators, input.theme])

    useEffect(() => {
        return () => {
            clearFlushTimer()
            if (!input.drawing || applyingRemoteRef.current) return
            const nextElements = getCurrentElements()
            if (!nextElements) return
            input.drawing.writeScene(nextElements, localOriginRef.current)
        }
    }, [input.drawing])

    useEffect(() => {
        if (!input.drawing) return

        const clearPointer = () => input.drawing?.clearPointer()
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') return
            clearPointer()
        }

        window.addEventListener('blur', clearPointer)
        document.addEventListener('visibilitychange', onVisibilityChange)

        return () => {
            window.removeEventListener('blur', clearPointer)
            document.removeEventListener('visibilitychange', onVisibilityChange)
            clearPointer()
        }
    }, [input.drawing])

    useEffect(() => {
        if (import.meta.env.VITE_E2E !== '1') return
        window.__mpadDrawingApi__ = api
        return () => {
            if (window.__mpadDrawingApi__ !== api) return
            delete window.__mpadDrawingApi__
        }
    }, [api])

    if (!input.drawing) {
        return (
            <div className='flex h-full items-center justify-center text-sm text-[--stone-text-dim]'>
                Connecting drawing…
            </div>
        )
    }

    const drawing = input.drawing

    return (
        <div className='h-full w-full overflow-hidden'>
            <Suspense
                fallback={
                    <div className='flex h-full items-center justify-center text-sm text-[--stone-text-dim]'>
                        Loading drawing…
                    </div>
                }
            >
                <ExcalidrawEditor
                    excalidrawAPI={setApi}
                    isCollaborating
                    onChange={(nextElements, appState) => {
                        if (applyingRemoteRef.current) return
                        if (
                            sameElements(
                                pendingElementsRef.current ?? [],
                                nextElements,
                            )
                        )
                            return
                        pendingElementsRef.current = nextElements
                        applyFlushPlan(
                            drawing,
                            readChangeFlushPlan({
                                pointerActive: pointerActiveRef.current,
                                editingLinearElement: Boolean(
                                    appState.editingLinearElement,
                                ),
                                editingTextElement: Boolean(
                                    appState.editingTextElement,
                                ),
                            }),
                        )
                    }}
                    onPointerUpdate={({ button, pointer }) => {
                        drawing.setPointer(pointer, button)
                    }}
                    onPointerDown={() => {
                        pointerActiveRef.current = true
                    }}
                    onPointerUp={() => {
                        pointerActiveRef.current = false
                        applyFlushPlan(
                            drawing,
                            readPointerUpFlushPlan({
                                editingLinearElement: Boolean(
                                    api?.getAppState().editingLinearElement,
                                ),
                                editingTextElement: Boolean(
                                    api?.getAppState().editingTextElement,
                                ),
                            }),
                        )
                    }}
                    initialData={{
                        elements,
                        appState: {
                            collaborators,
                            theme: input.theme,
                        },
                        scrollToContent: true,
                    }}
                    theme={input.theme}
                />
            </Suspense>
        </div>
    )
}
