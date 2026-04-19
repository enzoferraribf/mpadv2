import { describe, expect, test } from 'bun:test'
import {
    type TextCommentOverlay,
    buildCommentMarkers,
    closeMissingOverlayThread,
    readOverlayThread,
    readOverlayThreadId,
} from '@/pad-text/domain/comment-overlay'
import type { TextCommentThreadView } from '@/pad-text/infrastructure/text-comment-store'

describe('text comment overlay', () => {
    test('closes a thread overlay when that thread no longer exists', () => {
        const overlay: TextCommentOverlay = {
            kind: 'thread',
            threadId: 'thread-2',
        }
        const threads = [createThread({ id: 'thread-1' })]

        expect(closeMissingOverlayThread(overlay, threads)).toEqual({
            kind: 'closed',
        })
    })

    test('reads the active overlay thread and id', () => {
        const overlay: TextCommentOverlay = {
            kind: 'thread',
            threadId: 'thread-1',
        }
        const threads = [createThread({ id: 'thread-1', quote: 'beta' })]

        expect(readOverlayThreadId(overlay)).toBe('thread-1')
        expect(readOverlayThread(overlay, threads)?.quote).toBe('beta')
    })

    test('builds anchored and detached markers with one active thread', () => {
        const threads = [
            createThread({
                id: 'thread-b',
                anchor: { from: 6, to: 10, detached: false },
            }),
            createThread({
                id: 'thread-a',
                anchor: { from: 0, to: 0, detached: true },
            }),
            createThread({
                id: 'thread-c',
                anchor: { from: 11, to: 16, detached: true },
            }),
        ]

        expect(
            buildCommentMarkers({
                activeThreadId: 'thread-c',
                anchors: new Map([['thread-b', { top: 100, bottom: 124 }]]),
                detachedGap: 20,
                detachedTop: 12,
                threads,
            }),
        ).toEqual([
            {
                active: false,
                kind: 'detached',
                threadId: 'thread-a',
                top: 12,
            },
            {
                active: true,
                kind: 'detached',
                threadId: 'thread-c',
                top: 32,
            },
            {
                active: false,
                kind: 'anchored',
                threadId: 'thread-b',
                top: 112,
            },
        ])
    })
})

function createThread(input: {
    id: string
    anchor?: TextCommentThreadView['anchor']
    quote?: string
}) {
    return {
        id: input.id,
        quote: input.quote ?? input.id,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
        author: {
            id: 'peer-local',
            name: 'Naruto Uzumaki',
            textColor: '#ea580c',
            textColorLight: '#fdba7433',
        },
        anchor: input.anchor ?? { from: 0, to: 5, detached: false },
        messages: [],
        canDelete: true,
    } satisfies TextCommentThreadView
}
