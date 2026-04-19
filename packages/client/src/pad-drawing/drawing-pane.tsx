import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type {
    Collaborator,
    ExcalidrawImperativeAPI,
    SocketId,
} from '@excalidraw/excalidraw/types'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import '@excalidraw/excalidraw/index.css'
import type { DrawingHandle } from '@/pad-drawing/infrastructure/drawing-handle'
import type { DrawingTheme } from './drawing-theme'

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

                        if (pointerActiveRef.current) {
                            scheduleLiveFlush(drawing, 48)
                            return
                        }

                        if (appState.editingLinearElement) {
                            scheduleFlush(drawing, 80)
                            return
                        }

                        if (appState.editingTextElement) {
                            scheduleFlush(drawing, 150)
                            return
                        }

                        flushScene(drawing)
                    }}
                    onPointerUpdate={({ button, pointer }) => {
                        drawing.setPointer(pointer, button)
                    }}
                    onPointerDown={() => {
                        pointerActiveRef.current = true
                    }}
                    onPointerUp={() => {
                        pointerActiveRef.current = false
                        if (api?.getAppState().editingLinearElement) {
                            scheduleFlush(drawing, 80)
                            return
                        }
                        if (api?.getAppState().editingTextElement) {
                            scheduleFlush(drawing, 150)
                            return
                        }
                        scheduleFlush(drawing, 0)
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

function useDrawingState(
    drawing: DrawingHandle | null,
    ignoredOrigin: unknown,
) {
    const [elements, setElements] = useState<readonly ExcalidrawElement[]>([])
    const [collaborators, setCollaborators] = useState(
        new Map<SocketId, Collaborator>(),
    )
    useEffect(() => {
        if (!drawing) {
            setElements([])
            setCollaborators(new Map())
            return
        }

        const sync = () => {
            setElements(drawing.getElements())
            setCollaborators(drawing.getCollaborators())
        }

        sync()
        return drawing.subscribe((origin) => {
            if (origin === ignoredOrigin) return
            sync()
        })
    }, [drawing, ignoredOrigin])

    return { elements, collaborators }
}

function sameElements(
    left: readonly ExcalidrawElement[],
    right: readonly ExcalidrawElement[],
) {
    if (left.length !== right.length) return false

    return left.every((element, index) => {
        const other = right[index]
        if (!other) return false
        return (
            element.id === other.id &&
            element.version === other.version &&
            element.versionNonce === other.versionNonce &&
            element.updated === other.updated &&
            element.isDeleted === other.isDeleted
        )
    })
}
