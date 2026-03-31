import { assert, padPath, parsePadRoomName, type PadPath, type PadRoomKind } from '@mmpad/shared'
import { listRelatedPads } from '../pad-tree/infrastructure/repository'
import { listPadDocRevisions, readPadDocRevisionText } from '../pad-doc/application/service'

type ApiRoute =
    | { kind: 'health' }
    | { kind: 'related'; path: PadPath }
    | { kind: 'text-history'; path: PadPath }
    | { kind: 'text-history-revision'; path: PadPath; revisionId: number }
    | { kind: 'not-found' }
    | { kind: 'room'; roomName: string; roomKind: PadRoomKind; awarenessClientId: number }

export async function handleRequest(req: Request) {
    if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))

    const route = parseRoute(req.url)

    if (route.kind === 'health') return withCors(Response.json({ status: 'ok' }))

    if (route.kind === 'related') {
        const tree = await listRelatedPads(route.path)
        return withCors(Response.json(tree))
    }

    if (route.kind === 'text-history') {
        const revisions = await listPadDocRevisions(route.path, 'text')
        return withCors(Response.json(revisions))
    }

    if (route.kind === 'text-history-revision') {
        const revision = await readPadDocRevisionText(route.path, route.revisionId)
        if (!revision) return withCors(new Response('Revision not found', { status: 404 }))
        return withCors(Response.json(revision))
    }

    if (route.kind === 'not-found') {
        return withCors(new Response('Not found', { status: 404 }))
    }

    return route
}

export function parseRoute(rawUrl: string): ApiRoute {
    const url = new URL(rawUrl)

    if (url.pathname === '/health') return { kind: 'health' }

    if (url.pathname.startsWith('/api/pads/')) {
        const suffix = url.pathname.slice('/api/pads'.length)

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
    response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', '*')
    return response
}
