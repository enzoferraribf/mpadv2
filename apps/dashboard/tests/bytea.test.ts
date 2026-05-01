import { describe, expect, test } from 'bun:test'
import { readBytea } from '../src/server/bytea'

describe('bytea decoding', () => {
    test('reads Uint8Array values', () => {
        expect(Array.from(readBytea(new Uint8Array([1, 2, 3])))).toEqual([
            1, 2, 3,
        ])
    })

    test('reads Postgres hex strings', () => {
        expect(Array.from(readBytea('\\x0102ff'))).toEqual([1, 2, 255])
    })
})
