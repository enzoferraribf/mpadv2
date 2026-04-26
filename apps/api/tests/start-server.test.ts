import { describe, expect, test } from 'bun:test'
import type { createServer } from '#/platform/http/server'
import { prepareServer, startServerWithDeps } from '#/platform/http/start'
import type { createServerRuntime } from '#/platform/runtime/runtime'

describe('start server', () => {
    test('runs schema migrations before readiness checks', async () => {
        const calls: string[] = []

        await prepareServer({
            async ensureDatabaseReady() {
                calls.push('ready')
            },
            async runSchemaMigrations() {
                calls.push('migrate')
            },
        })

        expect(calls).toEqual(['migrate', 'ready'])
    })

    test('creates the server with parsed config', async () => {
        const config = {
            clientIp: {
                source: 'cloudflare',
                trustProxyHeaders: false,
                allowDevelopmentFallback: false,
            } as const,
            clientOrigin: 'https://app.example.com',
            limits: {
                maxRelatedPads: 100,
                maxRoomClients: 32,
                rateLimitWindowMs: 60000,
                rateLimitWsUpgrades: 60,
            },
            port: 4100,
        }
        const server = { port: 4100 } as unknown as ReturnType<
            typeof createServer
        >
        const runtime = { name: 'runtime' } as unknown as ReturnType<
            typeof createServerRuntime
        >

        const created = await startServerWithDeps({
            createServer(input) {
                expect(input).toEqual({
                    clientIp: config.clientIp,
                    clientOrigin: config.clientOrigin,
                    port: config.port,
                    runtime,
                })
                return server
            },
            createServerRuntime(limits) {
                expect(limits).toBe(config.limits)
                return runtime
            },
            async ensureDatabaseReady() {},
            readServerConfig() {
                return config
            },
            async runSchemaMigrations() {
                return
            },
        })

        expect(created).toEqual({ runtime, server })
    })
})
