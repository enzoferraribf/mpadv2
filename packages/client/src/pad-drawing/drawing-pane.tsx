import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Collaborator, ExcalidrawImperativeAPI, SocketId } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import type { DrawingTheme } from './drawing-theme'
import type { DrawingHandle } from './drawing-handle'

const ExcalidrawEditor = lazy(() => import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw })))

export function DrawingPane(input: { drawing: DrawingHandle | null; theme: DrawingTheme }) {
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
    const localOriginRef = useRef({})
    const { collaborators, elements } = useDrawingState(input.drawing, localOriginRef.current)
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
        return api?.getSceneElementsIncludingDeleted() ?? pendingElementsRef.current
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
        applyingRemoteRef.current = true
        api.updateScene({
            elements,
            appState: {
                collaborators,
                theme: input.theme,
            },
        })
        queueMicrotask(() => {
            applyingRemoteRef.current = false
        })
    }, [collaborators, elements, input.theme])

    useEffect(() => {
        return () => {
            clearFlushTimer()
            if (!input.drawing || applyingRemoteRef.current) return
            const nextElements = getCurrentElements()
            if (!nextElements) return
            input.drawing.writeScene(nextElements, localOriginRef.current)
        }
    }, [input.drawing])

    if (!input.drawing) {
        return <div className="flex h-full items-center justify-center text-sm text-[--stone-text-dim]">Connecting drawing…</div>
    }

    const drawing = input.drawing

    return (
        <div className="h-full w-full overflow-hidden">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-[--stone-text-dim]">Loading drawing…</div>}>
                <ExcalidrawEditor
                    excalidrawAPI={setApi}
                    onChange={(nextElements, appState) => {
                        if (applyingRemoteRef.current) return
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

function useDrawingState(drawing: DrawingHandle | null, ignoredOrigin: unknown) {
    const [elements, setElements] = useState<readonly ExcalidrawElement[]>([])
    const [collaborators, setCollaborators] = useState(new Map<SocketId, Collaborator>())
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
