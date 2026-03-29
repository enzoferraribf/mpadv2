import type { PadPath, PadTreeItem } from '@mmpad/shared'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000'

export function roomWebSocketUrl(roomName: string, clientId: number) {
    const base = WS_URL.replace(/\/$/, '')
    return `${base}/${encodeURIComponent(roomName)}?client=${clientId}`
}

export async function fetchPadTree(path: PadPath, signal: AbortSignal) {
    return fetchJson<PadTreeItem[]>(`${API_URL}/api/pads${encodePadPath(path)}/related`, signal)
}

function encodePadPath(path: PadPath) {
    return path.split('/').map(encodeURIComponent).join('/')
}

async function fetchJson<T>(url: string, signal: AbortSignal) {
    const response = await fetch(url, { signal })
    return readJson<T>(response)
}

async function readJson<T>(response: Response) {
    if (!response.ok) throw new Error(await response.text())
    return response.json() as Promise<T>
}
