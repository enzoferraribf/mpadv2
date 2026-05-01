import { Y_DRAWING_ELEMENTS_KEY, Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { Doc, applyUpdate } from 'yjs'

export type StoredRevision = {
    revisionNumber: number
    update: Uint8Array
    snapshot: Uint8Array | null
}

export function readTextCharacters(revisions: StoredRevision[]) {
    const doc = mergeRevisions(revisions)
    try {
        return doc.getText(Y_TEXT_KEY).toString().length
    } finally {
        doc.destroy()
    }
}

export function readDrawingElementCount(revisions: StoredRevision[]) {
    const doc = mergeRevisions(revisions)
    try {
        const map = doc.getMap<string>(Y_DRAWING_ELEMENTS_KEY)
        return Array.from(map.values()).filter(isLiveDrawingElement).length
    } finally {
        doc.destroy()
    }
}

export function mergeRevisions(revisions: StoredRevision[]) {
    const doc = new Doc()
    const checkpointIndex = revisions.findLastIndex(
        (revision) => revision.snapshot !== null,
    )
    const startIndex = checkpointIndex === -1 ? 0 : checkpointIndex + 1
    const checkpoint = revisions[checkpointIndex]

    if (checkpoint?.snapshot) applyUpdate(doc, checkpoint.snapshot)
    for (const revision of revisions.slice(startIndex)) {
        applyUpdate(doc, revision.update)
    }

    return doc
}

function isLiveDrawingElement(value: string) {
    try {
        const element = JSON.parse(value) as { isDeleted?: boolean }
        return element.isDeleted !== true
    } catch {
        return false
    }
}
