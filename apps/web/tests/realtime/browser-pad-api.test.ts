import { describe, expect, test } from 'bun:test'
import { padApiUrl, roomWebSocketUrl } from '@/shared/realtime/application/api'
import { padPath } from '@mpad/core/pad-path'
import { padRoomName } from '@mpad/core/pad-room'

describe('browser pad api', () => {
    test('builds websocket room urls from encoded room names', () => {
        const path = padPath('notes/alpha beta')
        const roomName = padRoomName(path, 'text')

        expect(roomWebSocketUrl(roomName, 12)).toBe(
            'ws://localhost:4000/ws/%2Fnotes%2Falpha%20beta%3Atext?client=12',
        )
    })

    test('builds absolute http pad urls from encoded path segments', () => {
        const path = padPath('notes/alpha beta')

        expect(padApiUrl(path, '/related')).toBe(
            'http://localhost:4000/api/pads/notes/alpha%20beta/related',
        )
    })
})
