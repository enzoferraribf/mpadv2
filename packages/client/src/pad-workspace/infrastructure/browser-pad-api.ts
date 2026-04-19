import type { PadPath } from '@mpad/core/pad-path'

const DEFAULT_SERVER_ORIGIN = 'http://localhost:4000'

export function roomWebSocketUrl(roomName: string, clientId: number) {
    return `${readWebSocketOrigin()}/ws/${encodeURIComponent(roomName)}?client=${clientId}`
}

export function padApiUrl(path: PadPath, suffix: string) {
    return `/api/pads${encodePadPath(path)}${suffix}`
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

function readWebSocketOrigin() {
    const url = new URL(readServerOrigin())
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.origin
}

function readServerOrigin() {
    if (typeof window !== 'object') return DEFAULT_SERVER_ORIGIN
    if (!window.location?.origin) return DEFAULT_SERVER_ORIGIN
    return window.location.origin
}
