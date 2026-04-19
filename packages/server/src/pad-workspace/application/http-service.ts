import { type PadPath, padPath } from '@mpad/core/pad-path'
import { type PadRoomKind, parsePadRoomName } from '@mpad/core/pad-room'
import type { ServerRuntime } from '#/bootstrap/runtime'
import { applyApiResponseHeaders } from '#/infrastructure/security-headers'
import {
    listPadTextRevisions,
    readPadTextRevision,
    readPadTextRevisionUpdate,
    revertPadTextRevision,
} from '#/pad-text/application/text-history-service'
import { listRelatedPads } from '#/pad-tree/infrastructure/repository'

type ApiRoute =
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

export async function handleWorkspaceRequest(
    runtime: ServerRuntime,
    req: Request,
    appOrigin: string | null = null,
) {
    const requestOrigin = req.headers.get('Origin')
    if (req.method === 'OPTIONS')
        return respondToPreflight(requestOrigin, appOrigin)

    const route = parseWorkspaceRoute(req.url, req.method)

    if (route.kind === 'bad-request') {
        return withApiHeaders(
            new Response(route.message, { status: 400 }),
            appOrigin,
            requestOrigin,
        )
    }

    if (route.kind === 'health')
        return withApiHeaders(
            Response.json({ status: 'ok' }),
            appOrigin,
            requestOrigin,
        )

    if (route.kind === 'related') {
        const tree = await listRelatedPads(route.path)
        return withApiHeaders(Response.json(tree), appOrigin, requestOrigin)
    }

    if (route.kind === 'text-history') {
        const revisions = await listPadTextRevisions(runtime, route.path)
        return withApiHeaders(
            Response.json(revisions),
            appOrigin,
            requestOrigin,
        )
    }

    if (route.kind === 'text-history-revision') {
        const revision = await readPadTextRevision(
            runtime,
            route.path,
            route.revisionId,
        )
        if (!revision)
            return withApiHeaders(
                new Response('Revision not found', { status: 404 }),
                appOrigin,
                requestOrigin,
            )
        return withApiHeaders(Response.json(revision), appOrigin, requestOrigin)
    }

    if (route.kind === 'text-history-update') {
        const revision = await readPadTextRevisionUpdate(
            runtime,
            route.path,
            route.revisionId,
        )
        if (!revision)
            return withApiHeaders(
                new Response('Revision not found', { status: 404 }),
                appOrigin,
                requestOrigin,
            )
        const bytes = new Uint8Array(revision.byteLength)
        bytes.set(revision)
        return withApiHeaders(
            new Response(
                new Blob([bytes.buffer], {
                    type: 'application/octet-stream',
                }),
                {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
                },
            ),
            appOrigin,
            requestOrigin,
        )
    }

    if (route.kind === 'text-history-revert') {
        const result = await revertPadTextRevision(
            runtime,
            route.path,
            route.revisionId,
        )
        if (!result)
            return withApiHeaders(
                new Response('Revision not found', { status: 404 }),
                appOrigin,
                requestOrigin,
            )
        if (!result.changed)
            return withApiHeaders(
                new Response('Snapshot already matches the live document', {
                    status: 409,
                }),
                appOrigin,
                requestOrigin,
            )
        return withApiHeaders(
            Response.json(result.revision),
            appOrigin,
            requestOrigin,
        )
    }

    if (route.kind === 'not-found') {
        return withApiHeaders(
            new Response('Not found', { status: 404 }),
            appOrigin,
            requestOrigin,
        )
    }

    return route
}

function parseWorkspaceRoute(rawUrl: string, method = 'GET'): ApiRoute {
    const url = new URL(rawUrl)

    if (url.pathname === '/health') return { kind: 'health' }

    if (url.pathname.startsWith('/api/pads/')) {
        const suffix = url.pathname.slice('/api/pads'.length)

        if (method === 'POST') {
            const revertMatch = suffix.match(
                /^(\/.*)\/text\/history\/(\d+)\/revert$/,
            )
            if (revertMatch) {
                const [, rawPath, rawRevisionId] = revertMatch
                if (rawPath === undefined || rawRevisionId === undefined) {
                    return { kind: 'bad-request', message: 'Invalid route' }
                }
                const path = readPadPath(rawPath)
                if (!path)
                    return {
                        kind: 'bad-request',
                        message: 'Invalid pad path',
                    }
                return {
                    kind: 'text-history-revert',
                    path,
                    revisionId: Number(rawRevisionId),
                }
            }
        }

        const updateMatch = suffix.match(
            /^(\/.*)\/text\/history\/(\d+)\/update$/,
        )
        if (updateMatch) {
            const [, rawPath, rawRevisionId] = updateMatch
            if (rawPath === undefined || rawRevisionId === undefined) {
                return { kind: 'bad-request', message: 'Invalid route' }
            }
            const path = readPadPath(rawPath)
            if (!path)
                return {
                    kind: 'bad-request',
                    message: 'Invalid pad path',
                }
            return {
                kind: 'text-history-update',
                path,
                revisionId: Number(rawRevisionId),
            }
        }

        const detailMatch = suffix.match(/^(\/.*)\/text\/history\/(\d+)$/)
        if (detailMatch) {
            const [, rawPath, rawRevisionId] = detailMatch
            if (rawPath === undefined || rawRevisionId === undefined) {
                return { kind: 'bad-request', message: 'Invalid route' }
            }
            const path = readPadPath(rawPath)
            if (!path)
                return {
                    kind: 'bad-request',
                    message: 'Invalid pad path',
                }
            return {
                kind: 'text-history-revision',
                path,
                revisionId: Number(rawRevisionId),
            }
        }

        const historyMatch = suffix.match(/^(\/.*)\/text\/history$/)
        if (historyMatch) {
            const [, rawPath] = historyMatch
            if (rawPath === undefined) {
                return { kind: 'bad-request', message: 'Invalid route' }
            }
            const path = readPadPath(rawPath)
            if (!path)
                return {
                    kind: 'bad-request',
                    message: 'Invalid pad path',
                }
            return {
                kind: 'text-history',
                path,
            }
        }

        if (suffix.endsWith('/related')) {
            const path = readPadPath(suffix.slice(0, -'/related'.length))
            if (!path)
                return {
                    kind: 'bad-request',
                    message: 'Invalid pad path',
                }
            return {
                kind: 'related',
                path,
            }
        }

        return { kind: 'not-found' }
    }

    if (url.pathname.startsWith('/ws/')) {
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

    return { kind: 'not-found' }
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

function respondToPreflight(
    requestOrigin: string | null,
    appOrigin: string | null,
) {
    if (appOrigin !== null && requestOrigin !== appOrigin) {
        return withApiHeaders(
            new Response('Forbidden', { status: 403 }),
            appOrigin,
            requestOrigin,
        )
    }

    return withApiHeaders(
        new Response(null, { status: 204 }),
        appOrigin,
        requestOrigin,
    )
}

function withApiHeaders(
    response: Response,
    appOrigin: string | null,
    requestOrigin: string | null,
) {
    return applyApiResponseHeaders(response, {
        appOrigin,
        requestOrigin,
    })
}
