import type {
    PadPath,
    PadTextHistoryResponse,
    PadTextRevisionResponse,
    PadTreeResponse,
} from '@mmpad/shared'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000'

export type PadTextHistoryEntry = PadTextHistoryResponse[number]
export type PadTextHistoryRevision = PadTextRevisionResponse

export function roomWebSocketUrl(roomName: string, clientId: number) {
    const base = WS_URL.replace(/\/$/, '')
    return `${base}/${encodeURIComponent(roomName)}?client=${clientId}`
}

export async function fetchPadTree(path: PadPath, signal: AbortSignal) {
    return fetchJson<PadTreeResponse>(`${API_URL}/api/pads${encodePadPath(path)}/related`, signal)
}

export async function fetchPadTextHistory(path: PadPath, signal: AbortSignal) {
    return fetchJson<PadTextHistoryResponse>(`${API_URL}/api/pads${encodePadPath(path)}/text/history`, signal)
}

export async function fetchPadTextRevision(path: PadPath, revisionId: number, signal: AbortSignal) {
    return fetchJson<PadTextRevisionResponse>(`${API_URL}/api/pads${encodePadPath(path)}/text/history/${revisionId}`, signal)
}

export async function fetchPadTextRevisionUpdate(path: PadPath, revisionId: number) {
    const response = await fetch(`${API_URL}/api/pads${encodePadPath(path)}/text/history/${revisionId}/update`)
    if (!response.ok) throw new Error(await response.text())
    return new Uint8Array(await response.arrayBuffer())
}

export async function revertPadTextRevision(path: PadPath, revisionId: number) {
    const response = await fetch(`${API_URL}/api/pads${encodePadPath(path)}/text/history/${revisionId}/revert`, {
        method: 'POST',
    })
    return readJson<PadTextHistoryEntry>(response)
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
