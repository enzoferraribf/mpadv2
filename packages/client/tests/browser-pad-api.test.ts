import { describe, expect, test } from 'bun:test'
import { padPath } from '@mpad/core/pad-path'
import { padRoomName } from '@mpad/core/pad-room'
import { padApiUrl, roomWebSocketUrl } from '../src/pad-workspace/infrastructure/browser-pad-api'

describe('browser pad api', () => {
    test('builds websocket room urls from encoded room names', () => {
        const path = padPath('notes/alpha beta')
        const roomName = padRoomName(path, 'text')

        expect(roomWebSocketUrl(roomName, 12)).toBe('ws://localhost:4000/%2Fnotes%2Falpha%20beta%3Atext?client=12')
    })

    test('builds http pad urls from encoded path segments', () => {
        const path = padPath('notes/alpha beta')

        expect(padApiUrl(path, '/text/history')).toBe('http://localhost:4000/api/pads/notes/alpha%20beta/text/history')
    })
})
