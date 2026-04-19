import { afterEach, describe, expect, test } from 'bun:test'
import {
    padApiUrl,
    readPadServerConfig,
    roomWebSocketUrl,
} from '@/pad-workspace/infrastructure/browser-pad-api'
import { padPath } from '@mpad/core/pad-path'
import { padRoomName } from '@mpad/core/pad-room'

describe('browser pad api', () => {
    afterEach(() => {
        const runtime = globalThis as typeof globalThis & { window?: Window }
        if (runtime.window) delete runtime.window.__MPAD_CONFIG__
    })

    test('builds websocket room urls from encoded room names', () => {
        withRuntimeConfig(undefined)
        const path = padPath('notes/alpha beta')
        const roomName = padRoomName(path, 'text')

        expect(roomWebSocketUrl(roomName, 12)).toBe(
            'ws://localhost:4000/%2Fnotes%2Falpha%20beta%3Atext?client=12',
        )
    })

    test('builds http pad urls from encoded path segments', () => {
        withRuntimeConfig(undefined)
        const path = padPath('notes/alpha beta')

        expect(padApiUrl(path, '/text/history')).toBe(
            'http://localhost:4000/api/pads/notes/alpha%20beta/text/history',
        )
    })

    test('prefers runtime config over vite env values', () => {
        withRuntimeConfig({
            serverOrigin: 'https://api.example.com/',
        })

        expect(readPadServerConfig()).toEqual({
            serverOrigin: 'https://api.example.com',
            wsServerOrigin: 'wss://api.example.com',
        })
    })

    test('derives websocket origin from the server origin', () => {
        withRuntimeConfig({
            serverOrigin: 'https://api.example.com/',
        })

        expect(readPadServerConfig()).toEqual({
            serverOrigin: 'https://api.example.com',
            wsServerOrigin: 'wss://api.example.com',
        })
    })

    test('uses separate http and websocket origins', () => {
        withRuntimeConfig({
            serverOrigin: 'https://api.example.com',
            wsServerOrigin: 'wss://ws.example.com',
        })

        const path = padPath('notes/alpha beta')
        const roomName = padRoomName(path, 'text')

        expect(padApiUrl(path, '/related')).toBe(
            'https://api.example.com/api/pads/notes/alpha%20beta/related',
        )
        expect(roomWebSocketUrl(roomName, 12)).toBe(
            'wss://ws.example.com/%2Fnotes%2Falpha%20beta%3Atext?client=12',
        )
    })
})

function withRuntimeConfig(config: Window['__MPAD_CONFIG__']) {
    const runtime = globalThis as typeof globalThis & { window?: Window }
    if (!runtime.window) {
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {},
            writable: true,
        })
    }

    runtime.window!.__MPAD_CONFIG__ = config
}
