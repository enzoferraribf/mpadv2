import { ensureDatabaseReady } from '#/db/migrate'
import { listRelatedPads } from '#/db/tree-repo'
import { applyApiResponseHeaders } from '#/platform/http/headers'
import type { ServerRuntime } from '#/platform/runtime/runtime'
import { type ApiRoute, parseWorkspaceRoute } from '#/workspace/route'

export async function handleWorkspaceRequest(
    runtime: ServerRuntime,
    request: Request,
    clientOrigin: string | null = null,
) {
    const requestOrigin = request.headers.get('Origin')
    if (request.method === 'OPTIONS')
        return respondToPreflight(requestOrigin, clientOrigin)

    const route = parseWorkspaceRoute(request.url, request.method)
    if (route.kind === 'room') return route

    const response = await handleApiRoute(runtime, route)
    return withApiHeaders(response, clientOrigin, requestOrigin)
}

function respondToPreflight(
    requestOrigin: string | null,
    clientOrigin: string | null,
) {
    if (clientOrigin !== null && requestOrigin !== clientOrigin) {
        return withApiHeaders(
            new Response('Forbidden', { status: 403 }),
            clientOrigin,
            requestOrigin,
        )
    }

    return withApiHeaders(
        new Response(null, { status: 204 }),
        clientOrigin,
        requestOrigin,
    )
}

function withApiHeaders(
    response: Response,
    clientOrigin: string | null,
    requestOrigin: string | null,
) {
    return applyApiResponseHeaders(response, {
        clientOrigin,
        requestOrigin,
    })
}

async function handleApiRoute(
    _runtime: ServerRuntime,
    route: Exclude<ApiRoute, { kind: 'room' }>,
) {
    switch (route.kind) {
        case 'bad-request':
            return new Response(route.message, { status: 400 })
        case 'health':
            return Response.json({ status: 'ok' })
        case 'ready':
            await ensureDatabaseReady()
            return Response.json({ status: 'ready' })
        case 'related':
            return Response.json(
                await listRelatedPads(
                    route.path,
                    _runtime.limits.maxRelatedPads,
                ),
            )
        case 'not-found':
            return new Response('Not found', { status: 404 })
    }
}
