import { describe, expect, test } from 'bun:test'
import { readDrawingScene } from '@/features/drawing/domain/scene'
import { Y_DRAWING_ELEMENTS_KEY } from '@mpad/core/pad-limits'
import { Doc } from 'yjs'

describe('drawing scene', () => {
    test('skips invalid element json', () => {
        const doc = new Doc()
        doc.getMap(Y_DRAWING_ELEMENTS_KEY).set('bad', '{')

        expect(readDrawingScene(doc)).toEqual([])

        doc.destroy()
    })
})
