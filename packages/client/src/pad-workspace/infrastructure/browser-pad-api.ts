import type { PadPath } from '@mmpad/shared'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000'

export function roomWebSocketUrl(roomName: string, clientId: number) {
    const base = WS_URL.replace(/\/$/, '')
    return `${base}/${encodeURIComponent(roomName)}?client=${clientId}`
}

export function padApiUrl(path: PadPath, suffix: string) {
    return `${API_URL}/api/pads${encodePadPath(path)}${suffix}`
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
