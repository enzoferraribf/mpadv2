import { WS_IDLE_TIMEOUT_S, WS_MAX_PAYLOAD } from '@mpad/shared'
import type { ServerWebSocket } from 'bun'
import { migrate } from './infrastructure/db'
import { handleRequest } from './transport/http-router'
import { closeSocket, flushPadRooms, handleSocketMessage, openSocket } from './transport/ws-router'
import type { WsData } from './transport/ws-data'

const PORT = Number(process.env.PORT ?? 4000)

await migrate()

Bun.serve<WsData>({
    port: PORT,
    hostname: '0.0.0.0',

    async fetch(req, server) {
        const route = await handleRequest(req)
        if (!(route instanceof Response)) {
            const upgraded = server.upgrade(req, {
                data: {
                    roomName: route.roomName,
                    roomKind: route.roomKind,
                    awarenessClientId: route.awarenessClientId,
                },
            })

            if (upgraded) return undefined as unknown as Response
            return new Response('Upgrade failed', { status: 500 })
        }

        return route
    },

    websocket: {
        idleTimeout: WS_IDLE_TIMEOUT_S,
        maxPayloadLength: WS_MAX_PAYLOAD,
        perMessageDeflate: false,

        open(ws) {
            void openSocket(ws)
        },

        message(ws, data) {
            if (typeof data === 'string') return
            const bytes = data instanceof ArrayBuffer
                ? new Uint8Array(data)
                : new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
            handleSocketMessage(ws, bytes)
        },

        close(ws: ServerWebSocket<WsData>) {
            void closeSocket(ws)
        },
    },
})

async function shutdown() {
    await flushPadRooms()
    process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
