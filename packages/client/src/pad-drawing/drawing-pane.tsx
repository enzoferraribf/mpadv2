import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Awareness } from 'y-protocols/awareness'
import type { Collaborator, ExcalidrawImperativeAPI, SocketId } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import type { DrawingAwarenessState, PadDrawingRoom } from '@/pad-session/pad-room-types'
import type { DrawingTheme } from './drawing-theme'
import { useDrawingScene, writeDrawingScene } from './drawing-scene'

const ExcalidrawEditor = lazy(() => import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw })))

export function DrawingPane(input: { room: PadDrawingRoom | null; theme: DrawingTheme }) {
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
    const localOriginRef = useRef({})
    const elements = useDrawingScene(input.room?.doc ?? null, localOriginRef.current)
    const collaborators = useCollaborators(input.room?.awareness ?? null)
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

    function flushScene(room: PadDrawingRoom) {
        clearFlushTimer()
        const nextElements = getCurrentElements()
        if (!nextElements) return
        pendingElementsRef.current = nextElements
        writeDrawingScene(room.doc, nextElements, localOriginRef.current)
    }

    function scheduleFlush(room: PadDrawingRoom, delayMs: number) {
        clearFlushTimer()
        flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null
            flushScene(room)
        }, delayMs)
    }

    function scheduleLiveFlush(room: PadDrawingRoom, delayMs: number) {
        if (flushTimerRef.current) return
        flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null
            flushScene(room)
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
            if (!input.room || applyingRemoteRef.current) return
            const nextElements = getCurrentElements()
            if (!nextElements) return
            writeDrawingScene(input.room.doc, nextElements, localOriginRef.current)
        }
    }, [input.room])

    if (!input.room) {
        return <div className="flex h-full items-center justify-center text-sm text-[--stone-text-dim]">Connecting drawing…</div>
    }

    const room = input.room

    return (
        <div className="h-full w-full overflow-hidden">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-[--stone-text-dim]">Loading drawing…</div>}>
                <ExcalidrawEditor
                    excalidrawAPI={setApi}
                    onChange={(nextElements, appState) => {
                        if (applyingRemoteRef.current) return
                        pendingElementsRef.current = nextElements

                        if (pointerActiveRef.current) {
                            scheduleLiveFlush(room, 48)
                            return
                        }

                        if (appState.editingLinearElement) {
                            scheduleFlush(room, 80)
                            return
                        }

                        if (appState.editingTextElement) {
                            scheduleFlush(room, 150)
                            return
                        }

                        flushScene(room)
                    }}
                    onPointerDown={() => {
                        pointerActiveRef.current = true
                    }}
                    onPointerUp={() => {
                        pointerActiveRef.current = false
                        if (api?.getAppState().editingLinearElement) {
                            scheduleFlush(room, 80)
                            return
                        }
                        if (api?.getAppState().editingTextElement) {
                            scheduleFlush(room, 150)
                            return
                        }
                        scheduleFlush(room, 0)
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

function useCollaborators(awareness: Awareness | null) {
    const [version, setVersion] = useState(0)

    useEffect(() => {
        if (!awareness) return
        const update = () => setVersion((value) => value + 1)
        awareness.on('change', update)
        return () => awareness.off('change', update)
    }, [awareness])

    return useMemo(() => {
        if (!awareness) return new Map<SocketId, Collaborator>()
        const entries: [SocketId, Collaborator][] = Array.from(awareness.getStates().entries()).flatMap(([clientId, state]) => {
            const user = (state as DrawingAwarenessState | null)?.user
            if (!user?.color) return []

            return [[
                String(clientId) as SocketId,
                {
                    username: user.name ?? null,
                    color: user.color,
                    isCurrentUser: clientId === awareness.clientID,
                },
            ]]
        })

        return new Map<SocketId, Collaborator>(entries)
    }, [awareness, version])
}
