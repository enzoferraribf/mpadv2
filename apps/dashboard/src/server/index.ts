import { existsSync } from 'node:fs'
import path from 'node:path'
import { SQL } from 'bun'
import { parseStatsDateRange } from './date-range'
import { readDashboardConfig } from './env'
import { readDashboardStats } from './stats'

const config = readDashboardConfig()
const sql = new SQL(config.DATABASE_URL)
const clientDist = path.resolve(import.meta.dir, '../../dist/client')
const cache = new Map<string, { expiresAt: number; body: string }>()

const server = Bun.serve({
    hostname: config.DASHBOARD_HOST,
    port: config.DASHBOARD_PORT,
    async fetch(request) {
        const url = new URL(request.url)

        try {
            if (url.pathname === '/api/health') {
                return Response.json({ status: 'ok' })
            }
            if (url.pathname === '/api/stats') {
                return await handleStats(url)
            }
            return serveStatic(url)
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Internal Server Error'
            return Response.json({ error: message }, { status: 400 })
        }
    },
})

console.log(
    `mpad dashboard listening on http://${server.hostname}:${server.port}`,
)

async function handleStats(url: URL) {
    const range = parseStatsDateRange(url, config.DASHBOARD_TIME_ZONE)
    const key = url.search
    const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
        return json(cached.body)
    }

    const stats = await readDashboardStats(
        sql,
        range,
        config.DASHBOARD_TIME_ZONE,
    )
    const body = JSON.stringify(stats)
    cache.set(key, {
        body,
        expiresAt: Date.now() + config.DASHBOARD_CACHE_TTL_MS,
    })
    return json(body)
}

function json(body: string) {
    return new Response(body, {
        headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json; charset=utf-8',
        },
    })
}

function serveStatic(url: URL) {
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname
    const filePath = path.resolve(clientDist, `.${pathname}`)
    if (!filePath.startsWith(clientDist) || !existsSync(filePath)) {
        return new Response(Bun.file(path.join(clientDist, 'index.html')), {
            headers: { 'Cache-Control': 'no-cache' },
        })
    }
    return new Response(Bun.file(filePath), {
        headers: cacheHeaders(filePath),
    })
}

function cacheHeaders(filePath: string) {
    if (filePath.endsWith('index.html')) return { 'Cache-Control': 'no-cache' }
    return { 'Cache-Control': 'public, max-age=31536000, immutable' }
}
