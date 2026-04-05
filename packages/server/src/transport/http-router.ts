import { assert, padPath, parsePadRoomName, type PadPath, type PadRoomKind } from '@mmpad/shared'
import { listRelatedPads } from '../pad-tree/infrastructure/repository'
import { listPadTextRevisions, readPadTextRevision, readPadTextRevisionUpdate, revertPadTextRevision } from '../pad-text/application/service'

type ApiRoute =
    | { kind: 'health' }
    | { kind: 'related'; path: PadPath }
    | { kind: 'text-history'; path: PadPath }
    | { kind: 'text-history-revision'; path: PadPath; revisionId: number }
    | { kind: 'text-history-update'; path: PadPath; revisionId: number }
    | { kind: 'text-history-revert'; path: PadPath; revisionId: number }
    | { kind: 'not-found' }
    | { kind: 'room'; roomName: string; roomKind: PadRoomKind; awarenessClientId: number }

export async function handleRequest(req: Request) {
    if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))

    const route = parseRoute(req.url, req.method)

    if (route.kind === 'health') return withCors(Response.json({ status: 'ok' }))

    if (route.kind === 'related') {
        const tree = await listRelatedPads(route.path)
        return withCors(Response.json(tree))
    }

    if (route.kind === 'text-history') {
        const revisions = await listPadTextRevisions(route.path)
        return withCors(Response.json(revisions))
    }

    if (route.kind === 'text-history-revision') {
        const revision = await readPadTextRevision(route.path, route.revisionId)
        if (!revision) return withCors(new Response('Revision not found', { status: 404 }))
        return withCors(Response.json(revision))
    }

    if (route.kind === 'text-history-update') {
        const revision = await readPadTextRevisionUpdate(route.path, route.revisionId)
        if (!revision) return withCors(new Response('Revision not found', { status: 404 }))
        const bytes = new Uint8Array(revision.byteLength)
        bytes.set(revision)
        return withCors(new Response(new Blob([bytes.buffer], {
            type: 'application/octet-stream',
        }), {
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        }))
    }

    if (route.kind === 'text-history-revert') {
        const result = await revertPadTextRevision(route.path, route.revisionId)
        if (!result) return withCors(new Response('Revision not found', { status: 404 }))
        if (!result.changed) return withCors(new Response('Snapshot already matches the live document', { status: 409 }))
        return withCors(Response.json(result.revision))
    }

    if (route.kind === 'not-found') {
        return withCors(new Response('Not found', { status: 404 }))
    }

    return route
}

export function parseRoute(rawUrl: string, method = 'GET'): ApiRoute {
    const url = new URL(rawUrl)

    if (url.pathname === '/health') return { kind: 'health' }

    if (url.pathname.startsWith('/api/pads/')) {
        const suffix = url.pathname.slice('/api/pads'.length)

        if (method === 'POST') {
            const revertMatch = suffix.match(/^(\/.*)\/text\/history\/(\d+)\/revert$/)
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

        const updateMatch = suffix.match(/^(\/.*)\/text\/history\/(\d+)\/update$/)
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
            return { kind: 'related', path: decodePadPath(suffix.slice(0, -'/related'.length)) }
        }

        return { kind: 'not-found' }
    }

    const awarenessClientId = Number(url.searchParams.get('client'))
    assert(Number.isInteger(awarenessClientId), 'Missing client id')
    const roomName = decodeURIComponent(url.pathname.slice(1))
    const room = parsePadRoomName(roomName)
    return {
        kind: 'room',
        roomName,
        roomKind: room.kind,
        awarenessClientId,
    }
}

function decodePadPath(value: string) {
    return padPath(decodeURIComponent(value))
}

function withCors(response: Response) {
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', '*')
    return response
}
