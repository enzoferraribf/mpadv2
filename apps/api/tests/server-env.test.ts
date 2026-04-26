import { describe, expect, test } from 'bun:test'
import { readServerConfig } from '#/platform/env'

describe('server env', () => {
    test('defaults port', () => {
        expect(readServerConfig({})).toEqual({
            clientIp: {
                source: 'cloudflare',
                trustProxyHeaders: false,
                allowDevelopmentFallback: true,
            },
            clientOrigin: null,
            limits: {
                maxRelatedPads: 100,
                maxRoomClients: 32,
                rateLimitWindowMs: 60000,
                rateLimitWsUpgrades: 60,
            },
            port: 4000,
        })
    })

    test('parses deploy env', () => {
        expect(
            readServerConfig({
                CLIENT_ORIGIN: 'https://app.example.com/path',
                CLIENT_IP_SOURCE: 'cloudflare',
                NODE_ENV: 'production',
                PORT: '5000',
            }),
        ).toEqual({
            clientIp: {
                source: 'cloudflare',
                trustProxyHeaders: false,
                allowDevelopmentFallback: false,
            },
            clientOrigin: 'https://app.example.com',
            limits: {
                maxRelatedPads: 100,
                maxRoomClients: 32,
                rateLimitWindowMs: 60000,
                rateLimitWsUpgrades: 60,
            },
            port: 5000,
        })
    })

    test('requires client origin in production', () => {
        expect(() =>
            readServerConfig({
                NODE_ENV: 'production',
            }),
        ).toThrow('CLIENT_ORIGIN is required when NODE_ENV=production.')
    })

    test('parses boolean env values strictly', () => {
        expect(
            readServerConfig({
                TRUST_PROXY_HEADERS: 'false',
            }).clientIp.trustProxyHeaders,
        ).toBe(false)
        expect(
            readServerConfig({
                TRUST_PROXY_HEADERS: 'true',
            }).clientIp.trustProxyHeaders,
        ).toBe(true)
        expect(() =>
            readServerConfig({
                TRUST_PROXY_HEADERS: 'yes',
            }),
        ).toThrow('Invalid TRUST_PROXY_HEADERS: yes')
    })
})
