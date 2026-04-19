import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

const clientDistDir = path.resolve(import.meta.dir, '../../../client/dist')
const clientIndexPath = path.join(clientDistDir, 'index.html')

export function serveClientApp(req: Request) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return new Response('Not found', { status: 404 })
    }

    const { pathname } = new URL(req.url)
    const assetPath = readClientAssetPath(pathname)
    if (assetPath) return new Response(Bun.file(assetPath))

    if (pathname.includes('.'))
        return new Response('Not found', { status: 404 })
    return new Response(Bun.file(clientIndexPath))
}

function readClientAssetPath(pathname: string) {
    const normalizedPath = pathname === '/' ? '/index.html' : pathname
    const decodedPath = decodeURIComponent(normalizedPath)
    const assetPath = path.resolve(clientDistDir, `.${decodedPath}`)

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
