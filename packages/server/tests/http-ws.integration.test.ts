import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { padPath } from '@mpad/core/pad-path'
import { padRoomName } from '@mpad/core/pad-room'
import { createDocUpdateMessage } from '@mpad/protocol/room-message-codec'
import { Doc, encodeStateAsUpdate } from 'yjs'
import { createServer } from '#/bootstrap/create-server'
import { createServerRuntime } from '#/bootstrap/runtime'
import { sql } from '#/infrastructure/db'
import { migrate } from '#/infrastructure/migration-runner'
import { flushWorkspaceRooms } from '#/pad-workspace/application/socket-service'

let port = 0
let server: ReturnType<typeof createServer> | null = null
let runtime = createServerRuntime()

beforeAll(async () => {
    await migrate()
})

afterEach(async () => {
    await flushWorkspaceRooms(runtime)
    if (server) {
        server.stop(true)
        server = null
    }
})

describe('http and websocket integration', () => {
    test('persists websocket text updates and serves them over http', async () => {
        const path = padPath(
            `integration/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        )
        runtime = createServerRuntime()
        server = createServer({ port: 0, appOrigin: null, runtime })
        port = server.port ?? 0
        expect(port).toBeGreaterThan(0)

        const socket = new WebSocket(readRoomUrl(port, path))
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

        const health = await fetch(`http://127.0.0.1:${port}/health`)
        expect(health.status).toBe(200)

        const history = await waitForTextHistory(port, path, runtime, 1)

        const revisionResponse = await fetch(
            `http://127.0.0.1:${port}/api/pads${path}/text/history/${history[0]!.id}`,
        )
        expect(revisionResponse.status).toBe(200)
        const revision = (await revisionResponse.json()) as { content: string }
        expect(revision.content).toBe('hello integration')

        socket.close()
        doc.destroy()
        await cleanupRoot(path)
    })

    test('returns the configured cors origin', async () => {
        runtime = createServerRuntime()
        server = createServer({
            port: 0,
            appOrigin: 'https://app.example.com',
            runtime,
        })
        port = server.port ?? 0

        const response = await fetch(`http://127.0.0.1:${port}/health`, {
            headers: {
                Origin: 'https://app.example.com',
            },
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://app.example.com',
        )
    })
})

function readRoomUrl(port: number, path: ReturnType<typeof padPath>) {
    const roomName = encodeURIComponent(padRoomName(path, 'text'))
    return `ws://127.0.0.1:${port}/ws/${roomName}?client=1`
}

function once(socket: WebSocket, event: 'open' | 'close') {
    return new Promise<void>((resolve, reject) => {
        const onError = (value: Event | ErrorEvent) => {
            socket.removeEventListener(event, onDone)
            reject(value)
        }
        const onDone = () => {
            socket.removeEventListener('error', onError)
            resolve()
        }

        socket.addEventListener(event, onDone, { once: true })
        socket.addEventListener('error', onError, { once: true })
    })
}

function onceMessage(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        const onError = (value: Event | ErrorEvent) => {
            socket.removeEventListener('message', onDone)
            reject(value)
        }
        const onDone = () => {
            socket.removeEventListener('error', onError)
            resolve()
        }

        socket.addEventListener('message', onDone, { once: true })
        socket.addEventListener('error', onError, { once: true })
    })
}

async function cleanupRoot(path: ReturnType<typeof padPath>) {
    const [root] = path.slice(1).split('/')
    if (!root) return

    await sql`
        DELETE FROM pads
        WHERE path = ${'/' + root} OR path LIKE ${'/' + root + '/%'}
    `
}

async function waitForTextHistory(
    port: number,
    path: ReturnType<typeof padPath>,
    runtime: ReturnType<typeof createServerRuntime>,
    count: number,
) {
    const deadline = Date.now() + 5_000

    while (Date.now() < deadline) {
        await flushWorkspaceRooms(runtime)

        const response = await fetch(
            `http://127.0.0.1:${port}/api/pads${path}/text/history`,
        )
        if (response.ok) {
            const history = (await response.json()) as Array<{ id: number }>
            if (history.length === count) return history
        }

        await Bun.sleep(25)
    }

    throw new Error(`Timed out waiting for ${count} text revisions`)
}
