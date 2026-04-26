import { describe, expect, test } from 'bun:test'
import { readTrustedClientIp } from '#/platform/http/client-ip'

describe('trusted client ip', () => {
    test('uses cloudflare connecting ip', () => {
        expect(
            readTrustedClientIp(
                request({
                    'cf-connecting-ip': '203.0.113.10',
                    'x-forwarded-for': '198.51.100.20',
                }),
                cloudflarePolicy,
            ),
        ).toBe('203.0.113.10')
    })

    test('does not trust forwarded headers in cloudflare production mode', () => {
        expect(
            readTrustedClientIp(
                request({ 'x-forwarded-for': '198.51.100.20' }),
                cloudflarePolicy,
            ),
        ).toBeNull()
    })

    test('rejects invalid cloudflare ip values', () => {
        expect(
            readTrustedClientIp(
                request({ 'cf-connecting-ip': 'not-an-ip' }),
                cloudflarePolicy,
            ),
        ).toBeNull()
    })

    test('allows development proxy fallback', () => {
        expect(
            readTrustedClientIp(
                request({ 'x-forwarded-for': '198.51.100.20, 203.0.113.10' }),
                {
                    source: 'cloudflare',
                    trustProxyHeaders: false,
                    allowDevelopmentFallback: true,
                },
            ),
        ).toBe('198.51.100.20')
    })
})

const cloudflarePolicy = {
    source: 'cloudflare',
    trustProxyHeaders: false,
    allowDevelopmentFallback: false,
} as const

function request(headers: Record<string, string>) {
    return new Request('https://api.example.com/ws/%2Fpad%3Atext', { headers })
}
