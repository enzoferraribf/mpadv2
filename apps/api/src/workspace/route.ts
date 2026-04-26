import { type PadPath, padPath } from '@mpad/core/pad-path'
import { type PadRoomKind, parsePadRoomName } from '@mpad/core/pad-room'

export type ApiRoute =
    | { kind: 'health' }
    | { kind: 'ready' }
    | { kind: 'related'; path: PadPath }
    | { kind: 'bad-request'; message: string }
    | { kind: 'not-found' }
    | {
          kind: 'room'
          roomName: string
          roomKind: PadRoomKind
          awarenessClientId: number
      }

type PadRouteParser = (suffix: string) => ApiRoute

const apiPadRouteParsers: PadRouteParser[] = [parseRelatedPadsRoute]

export function parseWorkspaceRoute(rawUrl: string, method = 'GET'): ApiRoute {
    const url = new URL(rawUrl)

    if (url.pathname === '/health') return { kind: 'health' }
    if (url.pathname === '/ready') return { kind: 'ready' }

    if (url.pathname.startsWith('/api/pads/')) {
        return parseApiPadRoute(url.pathname, method)
    }

    if (url.pathname.startsWith('/ws/')) {
        return parseWebSocketRoute(url)
    }

    return { kind: 'not-found' }
}

function parseApiPadRoute(pathname: string, _method: string): ApiRoute {
    const suffix = pathname.slice('/api/pads'.length)

    for (const parseRoute of apiPadRouteParsers) {
        const route = parseRoute(suffix)
        if (route.kind !== 'not-found') return route
    }

    return { kind: 'not-found' }
}

function parseRelatedPadsRoute(suffix: string): ApiRoute {
    if (!suffix.endsWith('/related')) return { kind: 'not-found' }

    const path = readPadPath(suffix.slice(0, -'/related'.length))
    if (!path) return { kind: 'bad-request', message: 'Invalid pad path' }
    return { kind: 'related', path }
}

function parseWebSocketRoute(url: URL): ApiRoute {
    const awarenessClientId = readAwarenessClientId(url)
    if (awarenessClientId === null) {
        return { kind: 'bad-request', message: 'Missing client id' }
    }

    const roomName = readDecodedRoomName(url.pathname)
    if (!roomName) {
        return { kind: 'bad-request', message: 'Invalid room name' }
    }

    const room = readPadRoom(roomName)
    if (!room) {
        return { kind: 'bad-request', message: 'Invalid room name' }
    }

    return {
        kind: 'room',
        roomName,
        roomKind: room.kind,
        awarenessClientId,
    }
}

function readPadPath(value: string) {
    try {
        return padPath(decodeURIComponent(value))
    } catch {
        return null
    }
}

function readAwarenessClientId(url: URL) {
    const rawValue = url.searchParams.get('client')
    if (!rawValue || !/^\d+$/.test(rawValue)) return null
    const value = Number(rawValue)
    if (!Number.isSafeInteger(value)) return null
    return value
}

function readDecodedRoomName(pathname: string) {
    try {
        return decodeURIComponent(pathname.slice('/ws/'.length))
    } catch {
        return null
    }
}

function readPadRoom(roomName: string) {
    try {
        return parsePadRoomName(roomName)
    } catch {
        return null
    }
}
