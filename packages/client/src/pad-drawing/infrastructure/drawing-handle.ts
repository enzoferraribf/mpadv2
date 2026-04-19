import type {
    DrawingAwarenessPointer,
    DrawingAwarenessState,
} from '@/collab/domain/pad-room-session'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type {
    Collaborator,
    CollaboratorPointer,
    SocketId,
} from '@excalidraw/excalidraw/types'
import type { Awareness } from 'y-protocols/awareness'
import type { Doc } from 'yjs'
import { readDrawingScene, writeDrawingScene } from './drawing-scene'

export type DrawingHandle = {
    getElements: () => readonly ExcalidrawElement[]
    getCollaborators: () => Map<SocketId, Collaborator>
    clearPointer: () => void
    setPointer: (
        pointer: DrawingAwarenessPointer,
        button: 'up' | 'down',
    ) => void
    subscribe: (listener: (origin: unknown) => void) => () => void
    writeScene: (
        elements: readonly ExcalidrawElement[],
        origin?: unknown,
    ) => void
}

export function createDrawingHandle(
    doc: Doc,
    awareness: Awareness,
): DrawingHandle {
    return {
        subscribe(listener) {
            const onDocUpdate = (_update: Uint8Array, origin: unknown) =>
                listener(origin)
            const onAwarenessChange = (change: {
                added: number[]
                updated: number[]
                removed: number[]
            }) => {
                const changedClients = [
                    ...change.added,
                    ...change.updated,
                    ...change.removed,
                ]
                if (changedClients.length === 0) return
                if (
                    changedClients.every(
                        (clientId) => clientId === awareness.clientID,
                    )
                )
                    return
                listener(null)
            }
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
        clearPointer() {
            const state =
                awareness.getLocalState() as DrawingAwarenessState | null
            if (!state || state.pointer === null) return
            awareness.setLocalState({
                ...state,
                pointer: null,
                button: 'up',
            })
        },
        setPointer(pointer, button) {
            const state =
                awareness.getLocalState() as DrawingAwarenessState | null
            if (!state) return
            if (
                state.pointer?.x === pointer.x &&
                state.pointer?.y === pointer.y &&
                state.pointer?.tool === pointer.tool &&
                state.button === button
            ) {
                return
            }

            awareness.setLocalState({
                ...state,
                pointer,
                button,
            })
        },
        writeScene(elements, origin) {
            writeDrawingScene(doc, elements, origin)
        },
    }
}

function readCollaborators(awareness: Awareness) {
    const entries: [SocketId, Collaborator][] = []

    for (const [clientId, state] of awareness.getStates().entries()) {
        if (clientId === awareness.clientID) continue

        const user = (state as DrawingAwarenessState | null)?.user
        if (!user?.color) continue
        const nextState = state as Partial<DrawingAwarenessState> | null
        const pointer = readCollaboratorPointer(nextState?.pointer ?? null)
        const button = readCollaboratorButton(nextState?.button ?? 'up')

        entries.push([
            String(clientId) as SocketId,
            {
                username: user.name ?? null,
                color: user.color,
                pointer,
                button,
            },
        ])
    }

    return new Map<SocketId, Collaborator>(entries)
}

function readCollaboratorPointer(
    value: DrawingAwarenessState['pointer'],
): CollaboratorPointer | undefined {
    if (!value) return undefined

    return {
        x: value.x,
        y: value.y,
        tool: value.tool,
        renderCursor: true,
    }
}

function readCollaboratorButton(value: DrawingAwarenessState['button']) {
    return value === 'down' ? 'down' : 'up'
}
