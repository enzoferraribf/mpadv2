import { existsSync } from 'node:fs'
import path from 'node:path'
import { SQL } from 'bun'
import { StatsDateRangeError, parseStatsDateRange } from './date-range'
import { readDashboardConfig } from './env'
import { readDashboardStats } from './stats'

const config = readDashboardConfig()
const sql = new SQL(config.DATABASE_URL)
const clientDist = path.resolve(import.meta.dir, '../../dist/client')

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
            if (error instanceof StatsDateRangeError) {
                return Response.json({ error: message }, { status: 400 })
            }
            console.error('dashboard request failed', {
                method: request.method,
                path: url.pathname,
                error,
            })
            return Response.json({ error: message }, { status: 500 })
        }
    },
})

console.log(
    `mpad dashboard listening on http://${server.hostname}:${server.port}`,
)

async function handleStats(url: URL) {
    const range = parseStatsDateRange(url, config.DASHBOARD_TIME_ZONE)
    const stats = await readDashboardStats(
        sql,
        range,
        config.DASHBOARD_TIME_ZONE,
    )
    return json(JSON.stringify(stats))
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
