import { describe, expect, test } from 'bun:test'
import type { createServer } from '#/bootstrap/create-server'
import type { createServerRuntime } from '#/bootstrap/runtime'
import { prepareServer, startServerWithDeps } from '#/bootstrap/start-server'

describe('start server', () => {
    test('skips schema migrations when disabled', async () => {
        const calls: string[] = []

        await prepareServer(
            {
                appOrigin: null,
                port: 4000,
                runSchemaMigrationsOnBoot: false,
            },
            {
                async ensureDatabaseReady() {
                    calls.push('ready')
                },
                async runSchemaMigrations() {
                    calls.push('migrate')
                },
            },
        )

        expect(calls).toEqual(['ready'])
    })

    test('runs schema migrations before readiness checks when enabled', async () => {
        const calls: string[] = []

        await prepareServer(
            {
                appOrigin: 'https://app.example.com',
                port: 4000,
                runSchemaMigrationsOnBoot: true,
            },
            {
                async ensureDatabaseReady() {
                    calls.push('ready')
                },
                async runSchemaMigrations() {
                    calls.push('migrate')
                },
            },
        )

        expect(calls).toEqual(['migrate', 'ready'])
    })

    test('creates the server with parsed config', async () => {
        const config = {
            appOrigin: 'https://app.example.com',
            port: 4100,
            runSchemaMigrationsOnBoot: false,
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
                throw new Error('should not run')
            },
        })

        expect(created).toEqual({ runtime, server })
    })
})
