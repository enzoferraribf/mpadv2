import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { Doc, encodeStateAsUpdate } from 'yjs'
import { padPath } from '@mpad/core/pad-path'
import { padRoomName } from '@mpad/core/pad-room'
import { createDocUpdateMessage } from '@mpad/protocol/room-message-codec'
import { createServer } from '../src/bootstrap/create-server'
import { sql } from '../src/infrastructure/db'
import { migrate } from '../src/infrastructure/migration-runner'
import { flushPadRooms } from '../src/transport/ws-router'

let port = 0
let server: ReturnType<typeof createServer> | null = null

beforeAll(async () => {
    await migrate()
})

afterEach(async () => {
    await flushPadRooms()
    if (server) {
        server.stop(true)
        server = null
    }
})

describe('http and websocket integration', () => {
    test('persists websocket text updates and serves them over http', async () => {
        const path = padPath(`integration/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`)
        server = createServer({ port: 0, appOrigin: null })
        port = server.port ?? 0
        expect(port).toBeGreaterThan(0)

        const socket = new WebSocket(readRoomUrl(port, path))
        await once(socket, 'open')
        await onceMessage(socket)

        const doc = new Doc()
        doc.getText('text').insert(0, 'hello integration')
        const message = createDocUpdateMessage(encodeStateAsUpdate(doc)).data
        socket.send(message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength))
        await Bun.sleep(100)
        await flushPadRooms()

        const health = await fetch(`http://127.0.0.1:${port}/health`)
        expect(health.status).toBe(200)

        const historyResponse = await fetch(`http://127.0.0.1:${port}/api/pads${path}/text/history`)
        expect(historyResponse.status).toBe(200)
        const history = await historyResponse.json() as Array<{ id: number }>
        expect(history).toHaveLength(1)

        const revisionResponse = await fetch(`http://127.0.0.1:${port}/api/pads${path}/text/history/${history[0]!.id}`)
        expect(revisionResponse.status).toBe(200)
        const revision = await revisionResponse.json() as { content: string }
        expect(revision.content).toBe('hello integration')

        socket.close()
        doc.destroy()
        await cleanupRoot(path)
    })

    test('returns the configured cors origin', async () => {
        server = createServer({ port: 0, appOrigin: 'https://app.example.com' })
        port = server.port ?? 0

        const response = await fetch(`http://127.0.0.1:${port}/health`, {
            headers: {
                Origin: 'https://app.example.com',
            },
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com')
    })
})

function readRoomUrl(port: number, path: ReturnType<typeof padPath>) {
    const roomName = encodeURIComponent(padRoomName(path, 'text'))
    return `ws://127.0.0.1:${port}/${roomName}?client=1`
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
