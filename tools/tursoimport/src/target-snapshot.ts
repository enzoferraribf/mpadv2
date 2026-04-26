import { Y_DRAWING_ELEMENTS_KEY, Y_TEXT_KEY } from '@mpad/core/pad-limits'
import type { PadDocKind } from '@mpad/core/pad-room'
import { Doc, applyUpdate } from 'yjs'
import { bytesEqual } from './utils'

export function docSnapshotsEqual(
    kind: PadDocKind,
    left: Uint8Array,
    right: Uint8Array,
) {
    if (bytesEqual(left, right)) return true

    if (kind === 'text') {
        return readSnapshotText(left) === readSnapshotText(right)
    }

    return (
        readSnapshotDrawingSignature(left) ===
        readSnapshotDrawingSignature(right)
    )
}

function readSnapshotText(bytes: Uint8Array) {
    const doc = new Doc()
    if (bytes.byteLength > 0) applyUpdate(doc, bytes)
    const text = doc.getText(Y_TEXT_KEY).toString()
    doc.destroy()
    return text
}

function readSnapshotDrawingSignature(bytes: Uint8Array) {
    const doc = new Doc()
    if (bytes.byteLength > 0) applyUpdate(doc, bytes)

    const order = doc.getArray<string>('order').toArray()
    const entries = Array.from(
        doc.getMap<unknown>(Y_DRAWING_ELEMENTS_KEY).entries(),
    ).sort(([left], [right]) => left.localeCompare(right))

    doc.destroy()
    return JSON.stringify({ entries, order })
}
