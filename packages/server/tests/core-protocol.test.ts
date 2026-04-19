import { describe, expect, test } from 'bun:test'
import { assert } from '@mpad/core/assert'
import { padPath } from '@mpad/core/pad-path'
import { padRoomName, parsePadRoomName } from '@mpad/core/pad-room'
import {
    createDocUpdateMessage,
    encodeClientRoomMessage,
    readClientRoomMessage,
    readServerRoomMessage,
} from '@mpad/protocol/room-message-codec'
import { Doc } from 'yjs'

describe('core and protocol boundaries', () => {
    test('normalizes pad paths', () => {
        expect(padPath('team//notes/alpha')).toBe('/team/notes/alpha')
        expect(() => padPath('')).toThrow('Pad path is required')
    })

    test('round-trips room names', () => {
        const roomName = padRoomName(padPath('team/notes'), 'drawing')
        expect(parsePadRoomName(roomName)).toEqual({
            path: '/team/notes',
            kind: 'drawing',
        })
    })

    test('round-trips sync messages', () => {
        const doc = new Doc()
        doc.getText('text').insert(0, 'hello')
        const encoded = encodeClientRoomMessage(
            createDocUpdateMessage(new Uint8Array([1, 2, 3])),
        )

        expect(readClientRoomMessage(encoded)).toEqual({
            kind: 'sync',
            data: encoded,
        })
        expect(readServerRoomMessage(encoded)).toEqual({
            kind: 'sync',
            data: encoded,
        })

        doc.destroy()
    })

    test('rejects invalid room messages', () => {
        expect(() => readClientRoomMessage(new Uint8Array([99]))).toThrow(
            'Unknown room message type: 99',
        )
    })

    test('assert helper throws on bad conditions', () => {
        expect(() => assert(false, 'nope')).toThrow('nope')
    })
})
