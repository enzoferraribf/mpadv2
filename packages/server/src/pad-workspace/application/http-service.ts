import type { ServerRuntime } from '#/bootstrap/runtime'
import { applyApiResponseHeaders } from '#/infrastructure/security-headers'
import {
    listPadTextRevisions,
    readPadTextRevision,
    readPadTextRevisionUpdate,
    revertPadTextRevision,
} from '#/pad-text/application/text-history-service'
import { listRelatedPads } from '#/pad-tree/infrastructure/repository'
import {
    type ApiRoute,
    parseWorkspaceRoute,
} from '#/pad-workspace/application/workspace-route'

export async function handleWorkspaceRequest(
    runtime: ServerRuntime,
    req: Request,
    appOrigin: string | null = null,
) {
    const requestOrigin = req.headers.get('Origin')
    if (req.method === 'OPTIONS')
        return respondToPreflight(requestOrigin, appOrigin)

    const route = parseWorkspaceRoute(req.url, req.method)
    if (route.kind === 'room') return route

    const response = await handleApiRoute(runtime, route)
    return withApiHeaders(response, appOrigin, requestOrigin)
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

async function handleApiRoute(
    runtime: ServerRuntime,
    route: Exclude<ApiRoute, { kind: 'room' }>,
) {
    switch (route.kind) {
        case 'bad-request':
            return new Response(route.message, { status: 400 })
        case 'health':
            return Response.json({ status: 'ok' })
        case 'related':
            return Response.json(await listRelatedPads(route.path))
        case 'text-history':
            return Response.json(
                await listPadTextRevisions(runtime, route.path),
            )
        case 'text-history-revision':
            return readHistoryRevisionResponse(
                await readPadTextRevision(
                    runtime,
                    route.path,
                    route.revisionId,
                ),
            )
        case 'text-history-update':
            return readHistoryUpdateResponse(
                await readPadTextRevisionUpdate(
                    runtime,
                    route.path,
                    route.revisionId,
                ),
            )
        case 'text-history-revert':
            return readHistoryRevertResponse(
                await revertPadTextRevision(
                    runtime,
                    route.path,
                    route.revisionId,
                ),
            )
        case 'not-found':
            return new Response('Not found', { status: 404 })
    }
}

function readHistoryRevisionResponse(
    revision: Awaited<ReturnType<typeof readPadTextRevision>>,
) {
    if (!revision) {
        return new Response('Revision not found', { status: 404 })
    }

    return Response.json(revision)
}

function readHistoryUpdateResponse(
    revision: Awaited<ReturnType<typeof readPadTextRevisionUpdate>>,
) {
    if (!revision) {
        return new Response('Revision not found', { status: 404 })
    }

    const bytes = new Uint8Array(revision.byteLength)
    bytes.set(revision)

    return new Response(
        new Blob([bytes.buffer], {
            type: 'application/octet-stream',
        }),
        {
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        },
    )
}

function readHistoryRevertResponse(
    result: Awaited<ReturnType<typeof revertPadTextRevision>>,
) {
    if (!result) {
        return new Response('Revision not found', { status: 404 })
    }

    if (!result.changed) {
        return new Response('Snapshot already matches the live document', {
            status: 409,
        })
    }

    return Response.json(result.revision)
}
