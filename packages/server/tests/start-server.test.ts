import { describe, expect, test } from 'bun:test'
import type { createServer } from '#/bootstrap/create-server'
import type { createServerRuntime } from '#/bootstrap/runtime'
import { prepareServer, startServerWithDeps } from '#/bootstrap/start-server'

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
            appOrigin: 'https://app.example.com',
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
                    appOrigin: config.appOrigin,
                    port: config.port,
                    runtime,
                })
                return server
            },
            createServerRuntime() {
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
