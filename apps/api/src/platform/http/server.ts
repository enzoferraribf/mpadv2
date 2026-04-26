import {
    WS_IDLE_TIMEOUT_S,
    WS_MAX_PAYLOAD,
    WS_POLICY_CLOSE_CODE,
} from '@mpad/core/pad-limits'
import type { Server, ServerWebSocket } from 'bun'
import {
    type ClientIpPolicy,
    readTrustedClientIp,
} from '#/platform/http/client-ip'
import { applyErrorResponseHeaders } from '#/platform/http/headers'
import { isAllowedWebSocketOrigin } from '#/platform/http/origin'
import type { ServerRuntime } from '#/platform/runtime/runtime'
import type { WsData } from '#/platform/ws/data'
import { handleWorkspaceRequest } from '#/workspace/http'
import type { ApiRoute } from '#/workspace/route'
import {
    closeWorkspaceSocket,
    flushWorkspaceRooms,
    handleWorkspaceSocketMessage,
    openWorkspaceSocket,
} from '#/workspace/ws'

type CreateServerInput = {
    clientIp?: ClientIpPolicy
    clientOrigin: string | null
    port: number
    runtime: ServerRuntime
}

const defaultClientIpPolicy: ClientIpPolicy = {
    source: 'cloudflare',
    trustProxyHeaders: false,
    allowDevelopmentFallback: true,
}

export function createServer(input: CreateServerInput) {
    const clientIpPolicy = input.clientIp ?? defaultClientIpPolicy

    return Bun.serve<WsData>({
        port: input.port,
        hostname: '0.0.0.0',
        development: false,

        async fetch(request, server) {
            const route = await handleWorkspaceRequest(
                input.runtime,
                request,
                input.clientOrigin,
            )
            if (route instanceof Response) return route

            return upgradeWorkspaceSocket(
                request,
                server,
                input,
                route,
                clientIpPolicy,
            )
        },

        error(error) {
            console.error(error)
            return applyErrorResponseHeaders(
                new Response('Internal Server Error', { status: 500 }),
            )
        },

        websocket: {
            idleTimeout: WS_IDLE_TIMEOUT_S,
            maxPayloadLength: WS_MAX_PAYLOAD,
            perMessageDeflate: false,

            open(socket) {
                input.runtime.rateLimiter.open(
                    socket.data.ip,
                    socket.data.roomName,
                )
                void openWorkspaceSocket(input.runtime, socket).catch(
                    (error) => {
                        console.error(error)
                        socket.close(WS_POLICY_CLOSE_CODE, 'Open failed')
                    },
                )
            },

            message(socket, data) {
                if (typeof data === 'string') return
                const bytes = toUint8Array(data)
                void handleWorkspaceMessage(input.runtime, socket, bytes)
            },

            close(socket: ServerWebSocket<WsData>) {
                input.runtime.rateLimiter.close(
                    socket.data.ip,
                    socket.data.roomName,
                )
                void closeWorkspaceSocket(input.runtime, socket)
            },
        },
    })
}

export async function shutdownServer(runtime: ServerRuntime) {
    await flushWorkspaceRooms(runtime)
}

function upgradeWorkspaceSocket(
    request: Request,
    server: Server<WsData>,
    input: CreateServerInput,
    route: Extract<ApiRoute, { kind: 'room' }>,
    clientIpPolicy: ClientIpPolicy,
) {
    if (
        !isAllowedWebSocketOrigin(
            input.clientOrigin,
            request.headers.get('origin'),
        )
    ) {
        return new Response('Forbidden', { status: 403 })
    }

    const ip = readTrustedClientIp(request, clientIpPolicy)
    if (!ip) {
        return new Response('Trusted client IP required', { status: 403 })
    }
    if (!input.runtime.rateLimiter.canOpen(ip, route.roomName)) {
        return new Response('Too Many Requests', { status: 429 })
    }

    return input.runtime.rateLimiter.canUpgrade(ip).then((allowed) => {
        if (!allowed) {
            return new Response('Too Many Requests', { status: 429 })
        }

        const upgraded = server.upgrade(request, {
            data: {
                awarenessClientId: route.awarenessClientId,
                ip,
                roomKind: route.roomKind,
                roomName: route.roomName,
            },
        })
        if (upgraded) return undefined as unknown as Response
        return new Response('Upgrade failed', { status: 500 })
    })
}

function toUint8Array(data: ArrayBuffer | Uint8Array) {
    if (data instanceof ArrayBuffer) return new Uint8Array(data)
    return new Uint8Array(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    )
}

async function handleWorkspaceMessage(
    runtime: ServerRuntime,
    socket: ServerWebSocket<WsData>,
    bytes: Uint8Array,
) {
    if (
        !(await runtime.rateLimiter.canAcceptMessage(
            socket.data.ip,
            bytes.byteLength,
        ))
    ) {
        socket.close(WS_POLICY_CLOSE_CODE, 'Rate limit exceeded')
        return
    }

    try {
        await handleWorkspaceSocketMessage(runtime, socket, bytes)
    } catch (error) {
        console.error(error)
        socket.close(WS_POLICY_CLOSE_CODE, 'Invalid message')
    }
}
