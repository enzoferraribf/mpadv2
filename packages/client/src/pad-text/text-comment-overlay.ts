import type { TextCommentStatus } from '@mmpad/shared'
import type { TextCommentSelection, TextCommentThreadView } from './text-comment-controller'

export type TextCommentOverlay =
    | { kind: 'closed' }
    | { kind: 'draft'; selection: TextCommentSelection }
    | { kind: 'thread'; threadId: string }

export type TextCommentRangeRect = {
    top: number
    bottom: number
}

export type TextCommentMarker = {
    threadId: string
    kind: 'anchored' | 'detached'
    top: number
    status: TextCommentStatus
    active: boolean
}

export function closeMissingOverlayThread(overlay: TextCommentOverlay, threads: TextCommentThreadView[]): TextCommentOverlay {
    if (overlay.kind !== 'thread') return overlay
    return threads.some((thread) => thread.id === overlay.threadId) ? overlay : { kind: 'closed' }
}

export function buildCommentMarkers(input: {
    activeThreadId: string | null
    anchors: Map<string, TextCommentRangeRect | null>
    detachedGap?: number
    detachedTop?: number
    threads: TextCommentThreadView[]
}) {
    const detachedGap = input.detachedGap ?? 28
    const detachedTop = input.detachedTop ?? 16
    const markers: TextCommentMarker[] = []
    let detachedIndex = 0

    for (const thread of input.threads) {
        const active = thread.id === input.activeThreadId
        if (thread.anchor.detached) {
            markers.push({
                threadId: thread.id,
                kind: 'detached',
                top: detachedTop + detachedIndex * detachedGap,
                status: thread.status,
                active,
            })
            detachedIndex += 1
            continue
        }

        const anchor = input.anchors.get(thread.id)
        if (!anchor) continue
        markers.push({
            threadId: thread.id,
            kind: 'anchored',
            top: Math.round((anchor.top + anchor.bottom) / 2),
            status: thread.status,
            active,
        })
    }

    return markers.sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === 'anchored' ? 1 : -1
        if (left.top !== right.top) return left.top - right.top
        return left.threadId.localeCompare(right.threadId)
    })
}

export function readOverlayThread(overlay: TextCommentOverlay, threads: TextCommentThreadView[]) {
    if (overlay.kind !== 'thread') return null
    return threads.find((thread) => thread.id === overlay.threadId) ?? null
}

export function readOverlayThreadId(overlay: TextCommentOverlay) {
    return overlay.kind === 'thread' ? overlay.threadId : null
}
