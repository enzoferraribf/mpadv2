import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Collaborator, SocketId } from '@excalidraw/excalidraw/types'
import type { Awareness } from 'y-protocols/awareness'
import type { Doc } from 'yjs'
import type { DrawingAwarenessState } from '@/pad-session/pad-room-types'
import { readDrawingScene, writeDrawingScene } from './drawing-scene'

export type DrawingHandle = {
    getElements: () => readonly ExcalidrawElement[]
    getCollaborators: () => Map<SocketId, Collaborator>
    subscribe: (listener: (origin: unknown) => void) => () => void
    writeScene: (elements: readonly ExcalidrawElement[], origin?: unknown) => void
}

export function createDrawingHandle(doc: Doc, awareness: Awareness): DrawingHandle {
    return {
        subscribe(listener) {
            const onDocUpdate = (_update: Uint8Array, origin: unknown) => listener(origin)
            const onAwarenessChange = () => listener(null)
            doc.on('update', onDocUpdate)
            awareness.on('change', onAwarenessChange)
            return () => {
                doc.off('update', onDocUpdate)
                awareness.off('change', onAwarenessChange)
            }
        },
        getElements() {
            return readDrawingScene(doc)
        },
        getCollaborators() {
            return readCollaborators(awareness)
        },
        writeScene(elements, origin) {
            writeDrawingScene(doc, elements, origin)
        },
    }
}

function readCollaborators(awareness: Awareness) {
    const entries: [SocketId, Collaborator][] = []

    for (const [clientId, state] of awareness.getStates().entries()) {
        const user = (state as DrawingAwarenessState | null)?.user
        if (!user?.color) continue

        entries.push([
            String(clientId) as SocketId,
            {
                username: user.name ?? null,
                color: user.color,
                isCurrentUser: clientId === awareness.clientID,
            },
        ])
    }

    return new Map<SocketId, Collaborator>(entries)
}
