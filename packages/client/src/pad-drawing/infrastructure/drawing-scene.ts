import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { Y_DRAWING_ELEMENTS_KEY } from '@mpad/core/pad-limits'
import { useEffect, useState } from 'react'
import type { Doc } from 'yjs'

export function useDrawingScene(doc: Doc | null, ignoredOrigin?: unknown) {
    const [elements, setElements] = useState<readonly ExcalidrawElement[]>([])

    useEffect(() => {
        if (!doc) {
            setElements([])
            return
        }

        const sync = () => {
            setElements(readDrawingScene(doc))
        }
        const handleUpdate = (_update: Uint8Array, origin: unknown) => {
            if (origin === ignoredOrigin) return
            sync()
        }

        doc.on('update', handleUpdate)
        sync()

        return () => {
            doc.off('update', handleUpdate)
        }
    }, [doc, ignoredOrigin])

    return elements
}

export function readDrawingScene(doc: Doc) {
    const order = doc.getArray<string>('order')
    const map = doc.getMap<string>(Y_DRAWING_ELEMENTS_KEY)
    const orderedIds = order.toArray()
    const seen = new Set(orderedIds)
    const allIds = [
        ...orderedIds,
        ...Array.from(map.keys()).filter((id) => !seen.has(id)),
    ]

    return allIds
        .map((id) => parseDrawingElement(map.get(id)))
        .filter((element): element is ExcalidrawElement => element !== null)
}

export function writeDrawingScene(
    doc: Doc,
    nextElements: readonly ExcalidrawElement[],
    origin?: unknown,
) {
    const order = doc.getArray<string>('order')
    const map = doc.getMap<string>(Y_DRAWING_ELEMENTS_KEY)
    const nextOrder = Array.from(
        new Set(nextElements.map((element) => element.id)),
    )

    doc.transact(() => {
        for (const element of nextElements) {
            const current = parseDrawingElement(map.get(element.id))
            if (current && !shouldReplaceElement(current, element)) continue

            const value = JSON.stringify(element)
            if (map.get(element.id) === value) continue
            map.set(element.id, value)
        }

        const mergedOrder = mergeOrder(
            order.toArray(),
            nextOrder,
            Array.from(map.keys()),
        )
        if (sameOrder(order.toArray(), mergedOrder)) return
        order.delete(0, order.length)
        order.insert(0, mergedOrder)
    }, origin)
}

function parseDrawingElement(value: string | undefined) {
    if (!value) return null
    return JSON.parse(value) as ExcalidrawElement
}

function shouldReplaceElement(
    current: ExcalidrawElement,
    next: ExcalidrawElement,
) {
    if (next.version !== current.version) return next.version > current.version
    if (next.versionNonce !== current.versionNonce)
        return next.updated >= current.updated
    return next.updated >= current.updated
}

function mergeOrder(
    currentOrder: string[],
    nextOrder: string[],
    allIds: string[],
) {
    const merged = [...nextOrder]
    const seen = new Set(merged)

    for (const id of currentOrder) {
        if (seen.has(id)) continue
        seen.add(id)
        merged.push(id)
    }

    for (const id of allIds) {
        if (seen.has(id)) continue
        seen.add(id)
        merged.push(id)
    }

    return merged
}

function sameOrder(left: string[], right: string[]) {
    if (left.length !== right.length) return false
    return left.every((value, index) => value === right[index])
}
