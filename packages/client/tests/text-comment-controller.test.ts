import { describe, expect, test } from 'bun:test'
import { Y_TEXT_KEY, type LocalPeer } from '@mmpad/shared'
import { Doc } from 'yjs'
import { createTextCommentController } from '../src/pad-text/infrastructure/text-comment-store'

describe('text comment controller', () => {
    test('creates, updates, resolves, reopens, and deletes threads', () => {
        const doc = createDoc('alpha beta gamma')
        const controller = createController(doc)

        const created = controller.createThread({
            selection: { from: 6, to: 10, quote: 'beta' },
            body: 'Root note',
        })

        expect(created.ok).toBe(true)
        const threadId = created.ok ? created.value.threadId : ''
        let thread = controller.getThread(threadId)
        expect(thread?.quote).toBe('beta')
        expect(thread?.messages).toHaveLength(1)
        expect(thread?.messages[0]?.body).toBe('Root note')

        const reply = controller.replyToThread({ threadId, body: 'Reply note' })
        expect(reply.ok).toBe(true)
        thread = controller.getThread(threadId)
        expect(thread?.messages).toHaveLength(2)

        const replyId = reply.ok ? reply.value.messageId : ''
        const edited = controller.editMessage({
            threadId,
            messageId: replyId,
            body: 'Reply note updated',
        })
        expect(edited).toEqual({ ok: true, value: undefined })
        thread = controller.getThread(threadId)
        expect(thread?.messages[1]?.body).toBe('Reply note updated')

        expect(controller.resolveThread(threadId)).toEqual({ ok: true, value: undefined })
        expect(controller.getThread(threadId)?.status).toBe('resolved')
        expect(controller.reopenThread(threadId)).toEqual({ ok: true, value: undefined })
        expect(controller.getThread(threadId)?.status).toBe('active')

        expect(controller.deleteMessage({ threadId, messageId: replyId })).toEqual({ ok: true, value: undefined })
        expect(controller.getThread(threadId)?.messages).toHaveLength(1)
        expect(controller.deleteMessage({ threadId, messageId: controller.getThread(threadId)!.messages[0]!.id })).toEqual({
            ok: false,
            error: 'Delete the full thread instead',
        })

        expect(controller.deleteThread(threadId)).toEqual({ ok: true, value: undefined })
        expect(controller.listThreads()).toHaveLength(0)
    })

    test('moves anchors with inserts and deletes before the range', () => {
        const doc = createDoc('alpha beta gamma')
        const controller = createController(doc)
        const text = doc.getText(Y_TEXT_KEY)

        controller.createThread({
            selection: { from: 6, to: 10, quote: 'beta' },
            body: 'Track beta',
        })
        expect(controller.listThreads()[0]?.anchor).toEqual({ from: 6, to: 10, detached: false })

        text.insert(0, 'wow ')
        expect(controller.listThreads()[0]?.anchor).toEqual({ from: 10, to: 14, detached: false })

        text.delete(0, 4)
        expect(controller.listThreads()[0]?.anchor).toEqual({ from: 6, to: 10, detached: false })
    })

    test('rejects overlapping comment ranges', () => {
        const doc = createDoc('alpha beta gamma')
        const controller = createController(doc)

        expect(controller.createThread({
            selection: { from: 6, to: 10, quote: 'beta' },
            body: 'First',
        })).toEqual({
            ok: true,
            value: { threadId: 'thread-1' },
        })

        expect(controller.validateSelection({ from: 8, to: 12, quote: 'ta g' })).toEqual({
            ok: false,
            error: 'Comments cannot overlap',
        })
        expect(controller.createThread({
            selection: { from: 8, to: 12, quote: 'ta g' },
            body: 'Second',
        })).toEqual({
            ok: false,
            error: 'Comments cannot overlap',
        })
    })

    test('marks a thread as detached when its full span is deleted', () => {
        const doc = createDoc('alpha beta gamma')
        const controller = createController(doc)
        const text = doc.getText(Y_TEXT_KEY)

        controller.createThread({
            selection: { from: 6, to: 10, quote: 'beta' },
            body: 'Track beta',
        })

        text.delete(6, 4)

        expect(controller.listThreads()[0]?.anchor.detached).toBe(true)
        expect(controller.getHighlightSpans()).toHaveLength(0)
    })
})

function createController(doc: Doc) {
    let index = 0
    return createTextCommentController(doc, createPeer(), {
        createId: () => `thread-${++index}`,
        now: () => `2026-04-01T00:00:0${index}Z`,
    })
}

function createDoc(content: string) {
    const doc = new Doc()
    doc.getText(Y_TEXT_KEY).insert(0, content)
    return doc
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
