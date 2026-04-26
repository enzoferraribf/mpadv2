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
        expect(padPath(`team/${'a'.repeat(160)}`)).toBe(
            `/team/${'a'.repeat(160)}`,
        )
        expect(() => padPath('')).toThrow('Pad path is required')
        expect(() => padPath('team/%/alpha')).toThrow(
            'Pad path contains unsafe characters',
        )
        expect(() => padPath('team/\n/alpha')).toThrow(
            'Pad path contains control chars',
        )
        expect(() => padPath('team/../alpha')).toThrow(
            'Pad path segment is unsafe',
        )
    })

    test('round-trips room names', () => {
        const roomName = padRoomName(padPath('team/notes'), 'drawing')
        expect(parsePadRoomName(roomName)).toEqual({
            path: '/team/notes',
            kind: 'drawing',
        })
        expect(() => parsePadRoomName('/team/%:text')).toThrow(
            'Pad path contains unsafe characters',
        )
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

    test('encodes heartbeat messages', () => {
        const encoded = encodeClientRoomMessage({ kind: 'heartbeat' })

        expect(readClientRoomMessage(encoded)).toEqual({
            kind: 'heartbeat',
        })
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
