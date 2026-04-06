import { describe, expect, test } from 'bun:test'
import { Y_TEXT_KEY, restoreTextDocFromUpdate, type LocalPeer } from '@mpad/shared'
import { Doc, encodeStateAsUpdate } from 'yjs'
import { createTextCommentController } from '../src/pad-text/infrastructure/text-comment-store'

describe('text revert', () => {
    test('restores text, comments, and attached or detached anchors from a saved update', () => {
        const target = new Doc()
        const targetController = createController(target)
        target.getText(Y_TEXT_KEY).insert(0, 'alpha beta gamma')

        const beta = targetController.createThread({
            selection: { from: 6, to: 10, quote: 'beta' },
            body: 'Track beta',
        })
        const gamma = targetController.createThread({
            selection: { from: 11, to: 16, quote: 'gamma' },
            body: 'Track gamma',
        })

        expect(beta.ok).toBe(true)
        expect(gamma.ok).toBe(true)

        target.getText(Y_TEXT_KEY).delete(11, 5)

        const live = new Doc()
        const liveController = createController(live)
        live.getText(Y_TEXT_KEY).insert(0, 'noise')
        liveController.createThread({
            selection: { from: 0, to: 5, quote: 'noise' },
            body: 'Old thread',
        })

        restoreTextDocFromUpdate(live, encodeStateAsUpdate(target))

        const threads = liveController.listThreads()
        expect(live.getText(Y_TEXT_KEY).toString()).toBe('alpha beta ')
        expect(threads).toHaveLength(2)
        expect(threads[0]).toEqual(expect.objectContaining({
            quote: 'beta',
            anchor: { from: 6, to: 10, detached: false },
            messages: [expect.objectContaining({ body: 'Track beta' })],
        }))
        expect(threads[1]).toEqual(expect.objectContaining({
            quote: 'gamma',
            anchor: { from: 0, to: 0, detached: true },
            messages: [expect.objectContaining({ body: 'Track gamma' })],
        }))
    })
})

function createController(doc: Doc) {
    let index = 0
    return createTextCommentController(doc, createPeer(), {
        createId: () => `thread-${++index}`,
        now: () => `2026-04-01T00:00:0${index}Z`,
    })
}

function createPeer(): LocalPeer {
    return {
        id: 'peer-local',
        name: 'Naruto Uzumaki',
        color: {
            background: '#f97316',
            stroke: '#7c2d12',
        },
        textColor: '#ea580c',
        textColorLight: '#fdba7433',
    }
}
