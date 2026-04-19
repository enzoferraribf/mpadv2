import type { PadPath } from '@mpad/core/pad-path'

type PadServerConfig = {
    httpServerOrigin: string
    wsServerOrigin: string
}

const DEFAULT_HTTP_SERVER_ORIGIN = 'http://localhost:4000'
const DEFAULT_WS_SERVER_ORIGIN = 'ws://localhost:4000'

export function roomWebSocketUrl(roomName: string, clientId: number) {
    const { wsServerOrigin } = readPadServerConfig()
    const base = wsServerOrigin.replace(/\/$/, '')
    return `${base}/${encodeURIComponent(roomName)}?client=${clientId}`
}

export function padApiUrl(path: PadPath, suffix: string) {
    const { httpServerOrigin } = readPadServerConfig()
    return `${httpServerOrigin}/api/pads${encodePadPath(path)}${suffix}`
}

export async function fetchApiJson<T>(url: string, signal: AbortSignal) {
    const response = await fetch(url, { signal })
    return readJson<T>(response)
}

export async function fetchApiBytes(url: string) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(await response.text())
    return new Uint8Array(await response.arrayBuffer())
}

export async function postApiJson<T>(url: string) {
    const response = await fetch(url, { method: 'POST' })
    return readJson<T>(response)
}

function encodePadPath(path: PadPath) {
    return path.split('/').map(encodeURIComponent).join('/')
}

async function readJson<T>(response: Response) {
    if (!response.ok) throw new Error(await response.text())
    return response.json() as Promise<T>
}

export function readPadServerConfig(): PadServerConfig {
    const runtimeConfig = typeof window === 'object'
        ? window.__MPAD_CONFIG__
        : undefined

    return {
        httpServerOrigin: stripTrailingSlash(runtimeConfig?.httpServerOrigin ?? import.meta.env.VITE_HTTP_SERVER_ORIGIN ?? DEFAULT_HTTP_SERVER_ORIGIN),
        wsServerOrigin: stripTrailingSlash(runtimeConfig?.wsServerOrigin ?? import.meta.env.VITE_WS_SERVER_ORIGIN ?? DEFAULT_WS_SERVER_ORIGIN),
    }
}

function stripTrailingSlash(value: string) {
    return value.replace(/\/$/, '')
}
