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
    test('persists websocket text updates', async () => {
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

        socket.close()
        doc.destroy()
        restored.destroy()
        await cleanupRoot(path)
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
