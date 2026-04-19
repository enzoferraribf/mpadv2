import { describe, expect, test } from 'bun:test'
import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { restoreTextDocFromUpdate } from '@mpad/text-core/text-revert'
import { Doc, encodeStateAsUpdate } from 'yjs'

describe('text revert', () => {
    test('restores text from a saved update', () => {
        const target = new Doc()
        target.getText(Y_TEXT_KEY).insert(0, 'alpha beta gamma')

        const live = new Doc()
        live.getText(Y_TEXT_KEY).insert(0, 'noise')

        restoreTextDocFromUpdate(live, encodeStateAsUpdate(target))

        expect(live.getText(Y_TEXT_KEY).toString()).toBe('alpha beta gamma')
    })
})
