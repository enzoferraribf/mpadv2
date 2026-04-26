import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { padPath } from '@mpad/core/pad-path'
import { createDocUpdateMessage } from '@mpad/protocol/room-message-codec'
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs'
import { migrate } from '#/db/migrate'
import { createServerRuntime } from '#/platform/runtime/runtime'
import {
    type TestRuntime,
    type TestServer,
    cleanupRoot,
    closeTestServer,
    flushWorkspaceRooms,
    once,
    onceMessage,
    openTestServer,
    readRoomUrl,
    testUrl,
} from './http-ws-testkit'

let port = 0
let server: TestServer | null = null
let runtime: TestRuntime = createServerRuntime()

beforeAll(async () => {
    await migrate()
})

afterEach(async () => {
    await closeTestServer({ runtime, server })
    server = null
})

describe('http and websocket integration', () => {
    test('persists websocket text updates and rejects history http', async () => {
        const path = padPath(
            `integration/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        )
        ;({ port, runtime, server } = openTestServer())
        expect(port).toBeGreaterThan(0)

        const socket = new WebSocket(readRoomUrl(port, path), {
            headers: { Origin: 'https://app.example.com' },
        })
        await once(socket, 'open')
        await onceMessage(socket)

        const doc = new Doc()
        doc.getText('text').insert(0, 'hello integration')
        const message = createDocUpdateMessage(encodeStateAsUpdate(doc)).data
        socket.send(
            message.buffer.slice(
                message.byteOffset,
                message.byteOffset + message.byteLength,
            ),
        )

        const health = await fetch(testUrl(port, '/health'))
        expect(health.status).toBe(200)
        const ready = await fetch(testUrl(port, '/ready'))
        expect(ready.status).toBe(200)
        expect(await ready.json()).toEqual({ status: 'ready' })

        await flushWorkspaceRooms(runtime)

        const stored = await runtime.docRepository.loadDoc(path, 'text')
        const restored = new Doc()
        if (stored.snapshot) applyUpdate(restored, stored.snapshot)
        for (const update of stored.updates) applyUpdate(restored, update)
        expect(restored.getText(Y_TEXT_KEY).toString()).toBe(
            'hello integration',
        )

        const removedHistoryResponse = await fetch(
            `http://127.0.0.1:${port}/api/pads${path}/text/history`,
        )
        expect(removedHistoryResponse.status).toBe(404)

        socket.close()
        doc.destroy()
        restored.destroy()
        await cleanupRoot(path)
    })

    test('returns the configured cors origin', async () => {
        ;({ port, runtime, server } = openTestServer())

        const response = await fetch(testUrl(port, '/health'), {
            headers: {
                Origin: 'https://app.example.com',
            },
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://app.example.com',
        )
    })

    test('does not emit cors headers for a different origin', async () => {
        ;({ port, runtime, server } = openTestServer())

        const response = await fetch(testUrl(port, '/health'), {
            headers: {
                Origin: 'https://evil.example.com',
            },
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    test('rejects preflight requests from a different origin', async () => {
        ;({ port, runtime, server } = openTestServer())

        const response = await fetch(testUrl(port, '/health'), {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://evil.example.com',
            },
        })

        expect(response.status).toBe(403)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    test('does not serve the static web app', async () => {
        ;({ port, runtime, server } = openTestServer())

        const response = await fetch(testUrl(port, '/'))

        expect(response.status).toBe(404)
        expect(response.headers.get('Content-Security-Policy')).toBeNull()
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })

    test('returns api security headers without wildcard cors', async () => {
        ;({ port, runtime, server } = openTestServer())

        const response = await fetch(testUrl(port, '/health'))

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Security-Policy')).toBeNull()
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
        expect(response.headers.get('Referrer-Policy')).toBe(
            'strict-origin-when-cross-origin',
        )
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    test('rejects malformed websocket requests without leaking bun errors', async () => {
        ;({ port, runtime, server } = openTestServer())

        const response = await fetch(
            testUrl(port, '/ws/%2Fpad%3Atext?client=abc'),
            {
                headers: {
                    Origin: 'https://app.example.com',
                },
            },
        )

        expect(response.status).toBe(400)
        const body = await response.text()
        expect(body).toContain('Missing client id')
        expect(body).not.toContain('__bunfallback')
        expect(body).not.toContain('/apps/api/')
    })

    test('rejects invalid room names without leaking stack traces', async () => {
        ;({ port, runtime, server } = openTestServer())

        const response = await fetch(testUrl(port, '/ws/not-a-room?client=1'), {
            headers: {
                Origin: 'https://app.example.com',
            },
        })

        expect(response.status).toBe(400)
        const body = await response.text()
        expect(body).toContain('Invalid room name')
        expect(body).not.toContain('__bunfallback')
        expect(body).not.toContain('/apps/api/')
    })

    test('rejects websocket upgrades without the configured origin', async () => {
        ;({ port, runtime, server } = openTestServer())

        const response = await fetch(
            testUrl(port, '/ws/%2Fpad%3Atext?client=1'),
        )

        expect(response.status).toBe(403)
    })

    test('does not expose dotfiles or encoded traversal paths', async () => {
        ;({ port, runtime, server } = openTestServer())

        const dotfile = await fetch(testUrl(port, '/.env'))
        expect(dotfile.status).toBe(404)

        const encodedDotfile = await fetch(testUrl(port, '/%2eenv'))
        expect(encodedDotfile.status).toBe(404)

        const traversal = await fetch(testUrl(port, '/%2e%2e/%2e%2e/.env'))
        expect(traversal.status).toBe(404)
    })
})
