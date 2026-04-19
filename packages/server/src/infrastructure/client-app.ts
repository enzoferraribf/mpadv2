import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { applyClientResponseHeaders } from '#/infrastructure/security-headers'

const clientDistDir = path.resolve(import.meta.dir, '../../../client/dist')
const clientIndexPath = path.join(clientDistDir, 'index.html')

export function serveClientApp(req: Request, appOrigin: string | null) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return applyClientResponseHeaders(
            new Response('Not found', { status: 404 }),
            appOrigin,
        )
    }

    const { pathname } = new URL(req.url)
    const decodedPath = readDecodedPath(pathname)
    if (decodedPath === null) {
        return applyClientResponseHeaders(
            new Response('Bad request', { status: 400 }),
            appOrigin,
        )
    }

    const assetPath = readClientAssetPath(decodedPath)
    if (assetPath)
        return applyClientResponseHeaders(
            new Response(Bun.file(assetPath)),
            appOrigin,
        )

    if (decodedPath.includes('.')) {
        return applyClientResponseHeaders(
            new Response('Not found', { status: 404 }),
            appOrigin,
        )
    }

    return applyClientResponseHeaders(
        new Response(Bun.file(clientIndexPath)),
        appOrigin,
    )
}

function readClientAssetPath(pathname: string) {
    const normalizedPath = pathname === '/' ? '/index.html' : pathname
    const assetPath = path.resolve(clientDistDir, `.${normalizedPath}`)

    if (!isInsideClientDist(assetPath)) return null
    if (!existsSync(assetPath)) return null
    if (!statSync(assetPath).isFile()) return null
    return assetPath
}

function isInsideClientDist(value: string) {
    return (
        value === clientDistDir ||
        value.startsWith(`${clientDistDir}${path.sep}`)
    )
}

function readDecodedPath(pathname: string) {
    try {
        return decodeURIComponent(pathname)
    } catch {
        return null
    }
}
