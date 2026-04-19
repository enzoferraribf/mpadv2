import { assert } from '@mpad/core/assert'
import { type PadPath, padPath } from '@mpad/core/pad-path'
import { type PadRoomKind, parsePadRoomName } from '@mpad/core/pad-room'
import type { ServerRuntime } from '#/bootstrap/runtime'
import { allowedCorsOrigin } from '#/infrastructure/origin'
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
    if (req.method === 'OPTIONS')
        return withCors(new Response(null, { status: 204 }), appOrigin)

    const route = parseWorkspaceRoute(req.url, req.method)

    if (route.kind === 'health')
        return withCors(Response.json({ status: 'ok' }), appOrigin)

    if (route.kind === 'related') {
        const tree = await listRelatedPads(route.path)
        return withCors(Response.json(tree), appOrigin)
    }

    if (route.kind === 'text-history') {
        const revisions = await listPadTextRevisions(runtime, route.path)
        return withCors(Response.json(revisions), appOrigin)
    }

    if (route.kind === 'text-history-revision') {
        const revision = await readPadTextRevision(
            runtime,
            route.path,
            route.revisionId,
        )
        if (!revision)
            return withCors(
                new Response('Revision not found', { status: 404 }),
                appOrigin,
            )
        return withCors(Response.json(revision), appOrigin)
    }

    if (route.kind === 'text-history-update') {
        const revision = await readPadTextRevisionUpdate(
            runtime,
            route.path,
            route.revisionId,
        )
        if (!revision)
            return withCors(
                new Response('Revision not found', { status: 404 }),
                appOrigin,
            )
        const bytes = new Uint8Array(revision.byteLength)
        bytes.set(revision)
        return withCors(
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
        )
    }

    if (route.kind === 'text-history-revert') {
        const result = await revertPadTextRevision(
            runtime,
            route.path,
            route.revisionId,
        )
        if (!result)
            return withCors(
                new Response('Revision not found', { status: 404 }),
                appOrigin,
            )
        if (!result.changed)
            return withCors(
                new Response('Snapshot already matches the live document', {
                    status: 409,
                }),
                appOrigin,
            )
        return withCors(Response.json(result.revision), appOrigin)
    }

    if (route.kind === 'not-found') {
        return withCors(new Response('Not found', { status: 404 }), appOrigin)
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
                assert(rawPath !== undefined, 'Missing history path')
                assert(rawRevisionId !== undefined, 'Missing revision id')
                return {
                    kind: 'text-history-revert',
                    path: decodePadPath(rawPath),
                    revisionId: Number(rawRevisionId),
                }
            }
        }

        const updateMatch = suffix.match(
            /^(\/.*)\/text\/history\/(\d+)\/update$/,
        )
        if (updateMatch) {
            const [, rawPath, rawRevisionId] = updateMatch
            assert(rawPath !== undefined, 'Missing history path')
            assert(rawRevisionId !== undefined, 'Missing revision id')
            return {
                kind: 'text-history-update',
                path: decodePadPath(rawPath),
                revisionId: Number(rawRevisionId),
            }
        }

        const detailMatch = suffix.match(/^(\/.*)\/text\/history\/(\d+)$/)
        if (detailMatch) {
            const [, rawPath, rawRevisionId] = detailMatch
            assert(rawPath !== undefined, 'Missing history path')
            assert(rawRevisionId !== undefined, 'Missing revision id')
            return {
                kind: 'text-history-revision',
                path: decodePadPath(rawPath),
                revisionId: Number(rawRevisionId),
            }
        }

        const historyMatch = suffix.match(/^(\/.*)\/text\/history$/)
        if (historyMatch) {
            const [, rawPath] = historyMatch
            assert(rawPath !== undefined, 'Missing history path')
            return {
                kind: 'text-history',
                path: decodePadPath(rawPath),
            }
        }

        if (suffix.endsWith('/related')) {
            return {
                kind: 'related',
                path: decodePadPath(suffix.slice(0, -'/related'.length)),
            }
        }

        return { kind: 'not-found' }
    }

    if (url.pathname.startsWith('/ws/')) {
        const awarenessClientId = Number(url.searchParams.get('client'))
        assert(Number.isInteger(awarenessClientId), 'Missing client id')
        const roomName = decodeURIComponent(url.pathname.slice('/ws/'.length))
        const room = parsePadRoomName(roomName)
        return {
            kind: 'room',
            roomName,
            roomKind: room.kind,
            awarenessClientId,
        }
    }

    return { kind: 'not-found' }
}

function decodePadPath(value: string) {
    return padPath(decodeURIComponent(value))
}

function withCors(response: Response, appOrigin: string | null) {
    response.headers.set(
        'Access-Control-Allow-Origin',
        allowedCorsOrigin(appOrigin),
    )
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', '*')
    response.headers.set('Vary', 'Origin')
    return response
}
