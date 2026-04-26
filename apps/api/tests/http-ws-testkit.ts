import type { padPath } from '@mpad/core/pad-path'
import { padRoomName } from '@mpad/core/pad-room'
import { sql } from '#/db/client'
import { createServer } from '#/platform/http/server'
import { createServerRuntime } from '#/platform/runtime/runtime'
import { flushWorkspaceRooms } from '#/workspace/ws'

export type TestServer = ReturnType<typeof createServer>
export type TestRuntime = ReturnType<typeof createServerRuntime>

export function openTestServer() {
    const runtime = createServerRuntime()
    const server = createServer({
        port: 0,
        clientOrigin: 'https://app.example.com',
        runtime,
    })
    const port = server.port ?? 0

    return { port, runtime, server }
}

export async function closeTestServer(input: {
    runtime: TestRuntime
    server: TestServer | null
}) {
    await flushWorkspaceRooms(input.runtime)
    input.server?.stop(true)
}

export { flushWorkspaceRooms }

export function testUrl(port: number, path: string) {
    return `http://127.0.0.1:${port}${path}`
}

export function readRoomUrl(port: number, path: ReturnType<typeof padPath>) {
    const roomName = encodeURIComponent(padRoomName(path, 'text'))
    return `ws://127.0.0.1:${port}/ws/${roomName}?client=1`
}

export function once(socket: WebSocket, event: 'open' | 'close') {
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

export function onceMessage(socket: WebSocket) {
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

export async function cleanupRoot(path: ReturnType<typeof padPath>) {
    const [root] = path.slice(1).split('/')
    if (!root) return

    await sql`
        DELETE FROM pads
        WHERE path = ${'/' + root} OR path LIKE ${'/' + root + '/%'}
    `
}
