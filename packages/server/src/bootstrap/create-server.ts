import { WS_IDLE_TIMEOUT_S, WS_MAX_PAYLOAD } from '@mpad/core/pad-limits'
import type { ServerWebSocket } from 'bun'
import type { ServerRuntime } from '#/bootstrap/runtime'
import { serveClientApp } from '#/infrastructure/client-app'
import { isAllowedWebSocketOrigin } from '#/infrastructure/origin'
import { handleWorkspaceRequest } from '#/pad-workspace/application/http-service'
import {
    closeWorkspaceSocket,
    flushWorkspaceRooms,
    handleWorkspaceSocketMessage,
    openWorkspaceSocket,
} from '#/pad-workspace/application/socket-service'
import type { WsData } from '#/transport/ws-data'

type CreateServerInput = {
    appOrigin: string | null
    port: number
    runtime: ServerRuntime
}

export function createServer(input: CreateServerInput) {
    return Bun.serve<WsData>({
        port: input.port,
        hostname: '0.0.0.0',

        async fetch(req, server) {
            const { pathname } = new URL(req.url)
            if (
                pathname !== '/health' &&
                !pathname.startsWith('/api/') &&
                !pathname.startsWith('/ws/')
            ) {
                return serveClientApp(req)
            }

            const route = await handleWorkspaceRequest(
                input.runtime,
                req,
                input.appOrigin,
            )
            if (!(route instanceof Response)) {
                if (
                    !isAllowedWebSocketOrigin(
                        input.appOrigin,
                        req.headers.get('origin'),
                    )
                ) {
                    return new Response('Forbidden', { status: 403 })
                }

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
                void openWorkspaceSocket(input.runtime, ws)
            },

            message(ws, data) {
                if (typeof data === 'string') return
                const bytes =
                    data instanceof ArrayBuffer
                        ? new Uint8Array(data)
                        : new Uint8Array(
                              data.buffer.slice(
                                  data.byteOffset,
                                  data.byteOffset + data.byteLength,
                              ),
                          )
                handleWorkspaceSocketMessage(input.runtime, ws, bytes)
            },

            close(ws: ServerWebSocket<WsData>) {
                void closeWorkspaceSocket(input.runtime, ws)
            },
        },
    })
}

export async function shutdownServer(runtime: ServerRuntime) {
    await flushWorkspaceRooms(runtime)
}
