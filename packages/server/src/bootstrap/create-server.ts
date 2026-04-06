import { WS_IDLE_TIMEOUT_S, WS_MAX_PAYLOAD } from '@mpad/core/pad-limits'
import type { ServerWebSocket } from 'bun'
import { handleRequest } from '../transport/http-router'
import { closeSocket, flushPadRooms, handleSocketMessage, openSocket } from '../transport/ws-router'
import type { WsData } from '../transport/ws-data'

export function createServer(port: number) {
    return Bun.serve<WsData>({
        port,
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
}

export async function shutdownServer() {
    await flushPadRooms()
}
