import { afterEach, describe, expect, test } from 'bun:test'
import {
    padApiUrl,
    readPadServerConfig,
    roomWebSocketUrl,
} from '@/pad-workspace/infrastructure/browser-pad-api'
import { padPath } from '@mpad/core/pad-path'
import { padRoomName } from '@mpad/core/pad-room'

const originalServerOrigin = process.env.VITE_SERVER_ORIGIN
const originalWsServerOrigin = process.env.VITE_WS_SERVER_ORIGIN

describe('browser pad api', () => {
    afterEach(() => {
        const runtime = globalThis as typeof globalThis & { window?: Window }
        if (runtime.window) delete runtime.window

        if (originalServerOrigin === undefined)
            delete process.env.VITE_SERVER_ORIGIN
        else process.env.VITE_SERVER_ORIGIN = originalServerOrigin

        if (originalWsServerOrigin === undefined)
            delete process.env.VITE_WS_SERVER_ORIGIN
        else process.env.VITE_WS_SERVER_ORIGIN = originalWsServerOrigin
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

    test('falls back to the current origin outside local vite dev', () => {
        withRuntimeConfig(undefined)
        withWindowLocation('https://app.example.com/workspace/demo')
        const path = padPath('notes/alpha beta')
        const roomName = padRoomName(path, 'text')

        expect(readPadServerConfig()).toEqual({
            serverOrigin: 'https://app.example.com',
            wsServerOrigin: 'wss://app.example.com',
        })
        expect(padApiUrl(path, '/text/history')).toBe(
            'https://app.example.com/api/pads/notes/alpha%20beta/text/history',
        )
        expect(roomWebSocketUrl(roomName, 12)).toBe(
            'wss://app.example.com/%2Fnotes%2Falpha%20beta%3Atext?client=12',
        )
    })

    test('keeps the local api default for vite dev without config', () => {
        withRuntimeConfig(undefined)
        withWindowLocation('http://127.0.0.1:5173/notes/demo')

        expect(readPadServerConfig()).toEqual({
            serverOrigin: 'http://localhost:4000',
            wsServerOrigin: 'ws://localhost:4000',
        })
    })

    test('prefers runtime config over vite env values', () => {
        process.env.VITE_SERVER_ORIGIN = 'https://env.example.com'
        process.env.VITE_WS_SERVER_ORIGIN = 'wss://env.example.com'
        withRuntimeConfig({
            serverOrigin: 'https://api.example.com/',
            wsServerOrigin: 'wss://ws.example.com/',
        })

        expect(readPadServerConfig()).toEqual({
            serverOrigin: 'https://api.example.com',
            wsServerOrigin: 'wss://ws.example.com',
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

function withWindowLocation(value: string) {
    const runtime = globalThis as typeof globalThis & { window?: Window }
    if (!runtime.window) withRuntimeConfig(undefined)
    runtime.window!.location = new URL(value) as unknown as Location
}
