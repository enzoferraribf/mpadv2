import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Collaborator, SocketId } from '@excalidraw/excalidraw/types'
import { useEffect, useState } from 'react'
import type { DrawingHandle } from './handle'

export type FlushPlan =
    | { kind: 'live'; delayMs: number }
    | { kind: 'scheduled'; delayMs: number }
    | { kind: 'immediate' }

export function readChangeFlushPlan(input: {
    pointerActive: boolean
    editingLinearElement: boolean
    editingTextElement: boolean
}): FlushPlan {
    if (input.pointerActive) return { kind: 'live', delayMs: 48 }
    if (input.editingLinearElement) return { kind: 'scheduled', delayMs: 80 }
    if (input.editingTextElement) return { kind: 'scheduled', delayMs: 150 }
    return { kind: 'immediate' }
}

export function readPointerUpFlushPlan(input: {
    editingLinearElement: boolean
    editingTextElement: boolean
}): FlushPlan {
    if (input.editingLinearElement) return { kind: 'scheduled', delayMs: 80 }
    if (input.editingTextElement) return { kind: 'scheduled', delayMs: 150 }
    return { kind: 'scheduled', delayMs: 0 }
}

export function useDrawingState(
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

export function sameElements(
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
