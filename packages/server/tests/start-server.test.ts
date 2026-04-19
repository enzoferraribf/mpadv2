import { describe, expect, test } from 'bun:test'
import type { createServer } from '../src/bootstrap/create-server'
import { prepareServer, startServer } from '../src/bootstrap/start-server'

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
        const server = { port: 4100 } as unknown as ReturnType<typeof createServer>

        const created = await startServer({
            createServer(input) {
                expect(input).toEqual(config)
                return server
            },
            async ensureDatabaseReady() {},
            readServerConfig() {
                return config
            },
            async runSchemaMigrations() {
                throw new Error('should not run')
            },
        })

        expect(created).toBe(server)
    })
})
