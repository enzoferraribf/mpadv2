import type { PadPath } from '@mpad/core/pad-path'

type PadServerConfig = {
    serverOrigin: string
    wsServerOrigin: string
}

const DEFAULT_SERVER_ORIGIN = 'http://localhost:4000'
const LOCAL_DEV_CLIENT_PORT = '5173'
const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function roomWebSocketUrl(roomName: string, clientId: number) {
    const { wsServerOrigin } = readPadServerConfig()
    const base = wsServerOrigin.replace(/\/$/, '')
    return `${base}/${encodeURIComponent(roomName)}?client=${clientId}`
}

export function padApiUrl(path: PadPath, suffix: string) {
    const { serverOrigin } = readPadServerConfig()
    return `${serverOrigin}/api/pads${encodePadPath(path)}${suffix}`
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
    const runtimeConfig =
        typeof window === 'object' ? window.__MPAD_CONFIG__ : undefined
    const serverOrigin = normalizeServerOrigin(
        runtimeConfig?.serverOrigin ??
            import.meta.env.VITE_SERVER_ORIGIN ??
            readFallbackServerOrigin(),
    )
    const wsServerOrigin = normalizeWebSocketOrigin(
        runtimeConfig?.wsServerOrigin ??
            import.meta.env.VITE_WS_SERVER_ORIGIN ??
            deriveWebSocketOrigin(serverOrigin),
    )

    return {
        serverOrigin,
        wsServerOrigin,
    }
}

function normalizeServerOrigin(value: string) {
    const url = new URL(value)
    return stripTrailingSlash(url.origin)
}

function normalizeWebSocketOrigin(value: string) {
    const url = new URL(value)
    return stripTrailingSlash(url.origin)
}

function deriveWebSocketOrigin(serverOrigin: string) {
    const url = new URL(serverOrigin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.origin
}

function stripTrailingSlash(value: string) {
    return value.replace(/\/$/, '')
}

function readFallbackServerOrigin() {
    if (typeof window !== 'object') return DEFAULT_SERVER_ORIGIN
    if (!window.location?.origin) return DEFAULT_SERVER_ORIGIN
    if (isLikelyLocalViteClient(window.location)) return DEFAULT_SERVER_ORIGIN
    return window.location.origin
}

function isLikelyLocalViteClient(location: Location) {
    return (
        LOCAL_DEV_HOSTS.has(location.hostname) &&
        location.port === LOCAL_DEV_CLIENT_PORT
    )
}
