import { afterEach, describe, expect, test } from 'bun:test'
import {
    padApiUrl,
    roomWebSocketUrl,
} from '@/pad-workspace/infrastructure/browser-pad-api'
import { padPath } from '@mpad/core/pad-path'
import { padRoomName } from '@mpad/core/pad-room'

describe('browser pad api', () => {
    afterEach(() => {
        const runtime = globalThis as typeof globalThis & { window?: Window }
        if (runtime.window) delete runtime.window
    })

    test('builds websocket room urls from encoded room names', () => {
        const path = padPath('notes/alpha beta')
        const roomName = padRoomName(path, 'text')

        expect(roomWebSocketUrl(roomName, 12)).toBe(
            'ws://localhost:4000/ws/%2Fnotes%2Falpha%20beta%3Atext?client=12',
        )
    })

    test('builds relative http pad urls from encoded path segments', () => {
        const path = padPath('notes/alpha beta')

        expect(padApiUrl(path, '/text/history')).toBe(
            '/api/pads/notes/alpha%20beta/text/history',
        )
    })

    test('uses the current origin outside local vite dev', () => {
        withWindowLocation('https://app.example.com/workspace/demo')
        const roomName = padRoomName(padPath('notes/alpha beta'), 'text')

        expect(roomWebSocketUrl(roomName, 12)).toBe(
            'wss://app.example.com/ws/%2Fnotes%2Falpha%20beta%3Atext?client=12',
        )
    })

    test('uses the current origin for local vite dev', () => {
        withWindowLocation('http://127.0.0.1:4174/notes/demo')
        const roomName = padRoomName(padPath('notes/alpha beta'), 'text')

        expect(roomWebSocketUrl(roomName, 12)).toBe(
            'ws://127.0.0.1:4174/ws/%2Fnotes%2Falpha%20beta%3Atext?client=12',
        )
    })
})

function withWindowLocation(value: string) {
    const runtime = globalThis as typeof globalThis & { window?: Window }
    if (!runtime.window) {
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {},
            writable: true,
        })
    }

    runtime.window!.location = new URL(value) as unknown as Location
}
