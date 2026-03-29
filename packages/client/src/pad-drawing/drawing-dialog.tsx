import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Y_DRAWING_APP_STATE_KEY, readDrawingTitle, writeDrawingTitle } from '@mmpad/shared'
import { useTheme } from 'next-themes'
import type { Awareness } from 'y-protocols/awareness'
import type { Collaborator, ExcalidrawImperativeAPI, SocketId } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { DrawingAwarenessState, PadDrawingRoom } from '@/pad-session/pad-room-types'
import { useDrawingScene, writeDrawingScene } from './drawing-scene'

const ExcalidrawEditor = lazy(() => import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw })))

export function DrawingDialog(input: {
    open: boolean
    onOpenChange: (open: boolean) => void
    room: PadDrawingRoom | null
}) {
    const { resolvedTheme } = useTheme()
    const elements = useDrawingScene(input.room?.doc ?? null)
    const remoteTitle = useDrawingTitle(input.room?.doc ?? null)
    const collaborators = useCollaborators(input.room?.awareness ?? null)
    const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
    const applyingRemoteRef = useRef(false)
    const previousRemoteTitleRef = useRef(remoteTitle)
    const [draftTitle, setDraftTitle] = useState(remoteTitle)

    useEffect(() => {
        const previousRemoteTitle = previousRemoteTitleRef.current
        if (draftTitle.trim() === previousRemoteTitle.trim()) setDraftTitle(remoteTitle)
        previousRemoteTitleRef.current = remoteTitle
    }, [draftTitle, remoteTitle])

    useEffect(() => {
        if (!input.open) return
        previousRemoteTitleRef.current = remoteTitle
        setDraftTitle(remoteTitle)
    }, [input.open, input.room?.roomName, remoteTitle])

    useEffect(() => {
        const api = apiRef.current
        if (!api) return
        applyingRemoteRef.current = true
        api.updateScene({
            elements,
            appState: {
                collaborators,
                theme: resolvedTheme === 'dark' ? 'dark' : 'light',
            },
        })
        queueMicrotask(() => {
            applyingRemoteRef.current = false
        })
    }, [collaborators, elements, resolvedTheme])

    useEffect(() => {
        const api = apiRef.current
        const room = input.room
        if (!api || !room) return

        return api.onChange((nextElements) => {
            if (applyingRemoteRef.current) return
            writeDrawingScene(room.doc, nextElements)
        })
    }, [input.open, input.room])

    const canSave = input.room !== null && draftTitle.trim().length > 0 && draftTitle.trim() !== remoteTitle

    function saveTitle() {
        if (!input.room) return
        writeDrawingTitle(input.room.doc, draftTitle)
        previousRemoteTitleRef.current = draftTitle.trim()
        setDraftTitle(draftTitle.trim())
    }

    return (
        <Dialog open={input.open} onOpenChange={input.onOpenChange}>
            <DialogContent className="flex h-[92vh] w-[94vw] max-w-none flex-col gap-0 p-4">
                <DialogHeader className="items-center pb-3">
                    <DialogTitle>Excalidraw</DialogTitle>
                </DialogHeader>

                <div className="flex items-center gap-3 pb-4 pr-10">
                    <input
                        type="text"
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        placeholder="Drawing name"
                        className="h-11 flex-1 rounded-md border border-[--stone-border] bg-[--stone-editor-bg] px-4 text-sm text-[--stone-text] outline-none placeholder:text-[--stone-text-dim] focus:border-[--stone-accent]"
                        disabled={input.room === null}
                    />
                    <Button
                        type="button"
                        onClick={saveTitle}
                        disabled={!canSave}
                        className="h-11 rounded-md bg-primary px-4 text-primary-foreground hover:bg-primary/90"
                    >
                        Save
                    </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-[--stone-border] bg-[--stone-editor-bg]">
                    {input.open ? (
                        input.room ? (
                            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-[--stone-text-dim]">Loading drawing…</div>}>
                                <ExcalidrawEditor
                                    excalidrawAPI={(api) => {
                                        apiRef.current = api
                                    }}
                                    initialData={{
                                        elements,
                                        appState: {
                                            collaborators,
                                            theme: resolvedTheme === 'dark' ? 'dark' : 'light',
                                        },
                                        scrollToContent: true,
                                    }}
                                    theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                                />
                            </Suspense>
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-[--stone-text-dim]">Connecting drawing…</div>
                        )
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}

function useDrawingTitle(doc: PadDrawingRoom['doc'] | null) {
    const [title, setTitle] = useState('')

    useEffect(() => {
        if (!doc) {
            setTitle('')
            return
        }

        const state = doc.getMap<string>(Y_DRAWING_APP_STATE_KEY)
        const update = () => setTitle(readDrawingTitle(doc))
        state.observe(update)
        update()

        return () => state.unobserve(update)
    }, [doc])

    return title
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
        const entries: [SocketId, Collaborator][] = Array.from(awareness.getStates().entries()).map(
            ([clientId, state]) => [
                String(clientId) as SocketId,
                {
                    username: (state as { user?: { name?: string } }).user?.name ?? null,
                    color: (state as DrawingAwarenessState).user.color,
                    isCurrentUser: clientId === awareness.clientID,
                },
            ],
        )

        return new Map<SocketId, Collaborator>(entries)
    }, [awareness, version])
}
