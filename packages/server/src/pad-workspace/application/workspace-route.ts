import { type PadPath, padPath } from '@mpad/core/pad-path'
import { type PadRoomKind, parsePadRoomName } from '@mpad/core/pad-room'

export type ApiRoute =
    | { kind: 'health' }
    | { kind: 'related'; path: PadPath }
    | { kind: 'bad-request'; message: string }
    | { kind: 'text-history'; path: PadPath }
    | { kind: 'text-history-revision'; path: PadPath; revisionId: number }
    | { kind: 'text-history-update'; path: PadPath; revisionId: number }
    | { kind: 'text-history-revert'; path: PadPath; revisionId: number }
    | { kind: 'not-found' }
    | {
          kind: 'room'
          roomName: string
          roomKind: PadRoomKind
          awarenessClientId: number
      }

export function parseWorkspaceRoute(rawUrl: string, method = 'GET'): ApiRoute {
    const url = new URL(rawUrl)

    if (url.pathname === '/health') return { kind: 'health' }

    if (url.pathname.startsWith('/api/pads/')) {
        return parseApiPadRoute(url.pathname, method)
    }

    if (url.pathname.startsWith('/ws/')) {
        return parseWebSocketRoute(url)
    }

    return { kind: 'not-found' }
}

function parseApiPadRoute(pathname: string, method: string): ApiRoute {
    const suffix = pathname.slice('/api/pads'.length)

    if (method === 'POST') {
        const revertRoute = readPadHistoryRoute(
            suffix,
            /^(\/.*)\/text\/history\/(\d+)\/revert$/,
        )
        if (revertRoute.kind !== 'not-found') {
            return revertRoute.kind === 'revision'
                ? {
                      kind: 'text-history-revert',
                      path: revertRoute.path,
                      revisionId: revertRoute.revisionId,
                  }
                : revertRoute
        }
    }

    const updateRoute = readPadHistoryRoute(
        suffix,
        /^(\/.*)\/text\/history\/(\d+)\/update$/,
    )
    if (updateRoute.kind !== 'not-found') {
        return updateRoute.kind === 'revision'
            ? {
                  kind: 'text-history-update',
                  path: updateRoute.path,
                  revisionId: updateRoute.revisionId,
              }
            : updateRoute
    }

    const revisionRoute = readPadHistoryRoute(
        suffix,
        /^(\/.*)\/text\/history\/(\d+)$/,
    )
    if (revisionRoute.kind !== 'not-found') {
        return revisionRoute.kind === 'revision'
            ? {
                  kind: 'text-history-revision',
                  path: revisionRoute.path,
                  revisionId: revisionRoute.revisionId,
              }
            : revisionRoute
    }

    const historyRoute = readPadPathRoute(suffix, /^(\/.*)\/text\/history$/)
    if (historyRoute.kind !== 'not-found') {
        return historyRoute.kind === 'path'
            ? {
                  kind: 'text-history',
                  path: historyRoute.path,
              }
            : historyRoute
    }

    if (suffix.endsWith('/related')) {
        const path = readPadPath(suffix.slice(0, -'/related'.length))
        if (!path) {
            return {
                kind: 'bad-request',
                message: 'Invalid pad path',
            }
        }
        return {
            kind: 'related',
            path,
        }
    }

    return { kind: 'not-found' }
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

function readPadHistoryRoute(suffix: string, pattern: RegExp) {
    const match = suffix.match(pattern)
    if (!match) return { kind: 'not-found' } as const

    const [, rawPath, rawRevisionId] = match
    if (rawPath === undefined || rawRevisionId === undefined) {
        return { kind: 'bad-request', message: 'Invalid route' } as const
    }

    const path = readPadPath(rawPath)
    if (!path) {
        return { kind: 'bad-request', message: 'Invalid pad path' } as const
    }

    return {
        kind: 'revision',
        path,
        revisionId: Number(rawRevisionId),
    } as const
}

function readPadPathRoute(suffix: string, pattern: RegExp) {
    const match = suffix.match(pattern)
    if (!match) return { kind: 'not-found' } as const

    const [, rawPath] = match
    if (rawPath === undefined) {
        return { kind: 'bad-request', message: 'Invalid route' } as const
    }

    const path = readPadPath(rawPath)
    if (!path) {
        return { kind: 'bad-request', message: 'Invalid pad path' } as const
    }

    return {
        kind: 'path',
        path,
    } as const
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
    return Number(rawValue)
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
