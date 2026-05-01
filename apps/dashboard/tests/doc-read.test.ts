import { describe, expect, test } from 'bun:test'
import { Y_DRAWING_ELEMENTS_KEY, Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { Doc, encodeStateAsUpdate } from 'yjs'
import {
    readDrawingElementCount,
    readTextCharacters,
} from '../src/server/doc-read'

describe('doc reconstruction', () => {
    test('reads latest text from revisions', () => {
        const doc = new Doc()
        const updates: Uint8Array[] = []
        doc.on('update', (update) => updates.push(update))
        doc.getText(Y_TEXT_KEY).insert(0, 'hello')
        doc.getText(Y_TEXT_KEY).insert(5, ' world')

        expect(
            readTextCharacters([
                { revisionNumber: 1, update: updates[0]!, snapshot: null },
                { revisionNumber: 2, update: updates[1]!, snapshot: null },
            ]),
        ).toBe(11)
        doc.destroy()
    })

    test('starts from the latest checkpoint', () => {
        const doc = new Doc()
        const updates: Uint8Array[] = []
        doc.on('update', (update) => updates.push(update))
        doc.getText(Y_TEXT_KEY).insert(0, 'one')
        const checkpoint = encodeStateAsUpdate(doc)
        doc.getText(Y_TEXT_KEY).insert(3, ' two')

        expect(
            readTextCharacters([
                {
                    revisionNumber: 1,
                    update: updates[0]!,
                    snapshot: checkpoint,
                },
                { revisionNumber: 2, update: updates[1]!, snapshot: null },
            ]),
        ).toBe(7)
        doc.destroy()
    })

    test('counts non-deleted drawing elements', () => {
        const doc = new Doc()
        const map = doc.getMap<string>(Y_DRAWING_ELEMENTS_KEY)
        map.set('a', JSON.stringify({ id: 'a', isDeleted: false }))
        map.set('b', JSON.stringify({ id: 'b', isDeleted: true }))
        const update = encodeStateAsUpdate(doc)

        expect(
            readDrawingElementCount([
                { revisionNumber: 1, update, snapshot: null },
            ]),
        ).toBe(1)
        doc.destroy()
    })
})
