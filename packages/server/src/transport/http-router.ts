import { assert, padPath, parsePadRoomName, type PadPath, type PadRoomKind } from '@mmpad/shared'
import { listRelatedPads } from '../pad-tree/infrastructure/repository'

type ApiRoute =
    | { kind: 'health' }
    | { kind: 'related'; path: PadPath }
    | { kind: 'room'; roomName: string; roomKind: PadRoomKind; awarenessClientId: number }

export async function handleRequest(req: Request) {
    if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))

    const route = parseRoute(req.url)

    if (route.kind === 'health') return withCors(Response.json({ status: 'ok' }))

    if (route.kind === 'related') {
        const tree = await listRelatedPads(route.path)
        return withCors(Response.json(tree))
    }

    return route
}

export function parseRoute(rawUrl: string): ApiRoute {
    const url = new URL(rawUrl)

    if (url.pathname === '/health') return { kind: 'health' }

    if (url.pathname.startsWith('/api/pads/')) {
        const suffix = url.pathname.slice('/api/pads'.length)

        if (suffix.endsWith('/related')) {
            return { kind: 'related', path: decodePadPath(suffix.slice(0, -'/related'.length)) }
        }
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
