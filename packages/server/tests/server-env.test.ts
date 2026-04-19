import { describe, expect, test } from 'bun:test'
import { readServerConfig } from '#/infrastructure/env'

describe('server env', () => {
    test('defaults port', () => {
        expect(readServerConfig({})).toEqual({
            appOrigin: null,
            port: 4000,
        })
    })

    test('parses deploy env', () => {
        expect(
            readServerConfig({
                APP_ORIGIN: 'https://app.example.com/path',
                NODE_ENV: 'production',
                PORT: '5000',
            }),
        ).toEqual({
            appOrigin: 'https://app.example.com',
            port: 5000,
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
