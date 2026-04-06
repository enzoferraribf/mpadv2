import { describe, expect, test } from 'bun:test'
import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs'
import { mergePadDoc } from '../src/collab/infrastructure/doc-store'

describe('pad doc compaction', () => {
    test('merges snapshot and updates into one document state', () => {
        const source = new Doc()
        const updates: Uint8Array[] = []

        source.on('update', (update) => updates.push(update))

        const text = source.getText(Y_TEXT_KEY)
        text.insert(0, 'hello')

        const snapshot = encodeStateAsUpdate(source)
        updates.length = 0

        text.insert(5, ' world')
        text.insert(11, '!')

        const merged = mergePadDoc(snapshot, updates)
        const restored = new Doc()
        applyUpdate(restored, merged)

        expect(restored.getText(Y_TEXT_KEY).toString()).toBe('hello world!')
    })
})
