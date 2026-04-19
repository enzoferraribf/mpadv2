import { describe, expect, test } from 'bun:test'
import { readServerConfig } from '#/infrastructure/env'

describe('server env', () => {
    test('defaults port and skips schema migrations on boot', () => {
        expect(readServerConfig({})).toEqual({
            appOrigin: null,
            port: 4000,
            runSchemaMigrationsOnBoot: false,
        })
    })

    test('parses deploy env', () => {
        expect(
            readServerConfig({
                APP_ORIGIN: 'https://app.example.com/path',
                NODE_ENV: 'production',
                PORT: '5000',
                RUN_SCHEMA_MIGRATIONS_ON_BOOT: '1',
            }),
        ).toEqual({
            appOrigin: 'https://app.example.com',
            port: 5000,
            runSchemaMigrationsOnBoot: true,
        })
    })

    test('requires app origin in production', () => {
        expect(() =>
            readServerConfig({
                NODE_ENV: 'production',
            }),
        ).toThrow('APP_ORIGIN is required when NODE_ENV=production.')
    })
})
