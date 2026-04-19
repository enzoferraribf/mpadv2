import { describe, expect, test } from 'bun:test'
import { readTextAwarenessStates } from '@/pad-text/infrastructure/text-awareness'

describe('text awareness', () => {
    test('ignores incomplete peer states', () => {
        const states = readTextAwarenessStates([
            [1, null],
            [2, {}],
            [
                3,
                {
                    user: { name: 'A', color: '#fff', colorLight: '#eee' },
                    files: [],
                },
            ],
        ])

        expect(states.size).toBe(1)
        expect(states.get(3)?.user.name).toBe('A')
    })
})
