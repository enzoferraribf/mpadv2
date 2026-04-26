import { describe, expect, test } from 'bun:test'
import {
    MAX_PAD_WRITES_PER_WINDOW,
    MAX_WS_MESSAGES_PER_WINDOW,
} from '@mpad/core/pad-limits'
import { createRateLimiter } from '#/platform/runtime/rate-limit'

describe('rate limiter', () => {
    test('limits websocket upgrades per ip', async () => {
        const limiter = createRateLimiter({
            maxRoomClients: 10,
            rateLimitWindowMs: 60_000,
            rateLimitWsUpgrades: 2,
        })

        expect(await limiter.canUpgrade('127.0.0.1')).toBe(true)
        expect(await limiter.canUpgrade('127.0.0.1')).toBe(true)
        expect(await limiter.canUpgrade('127.0.0.1')).toBe(false)
    })

    test('limits active clients per room', () => {
        const limiter = createRateLimiter({
            maxRoomClients: 1,
            rateLimitWindowMs: 60_000,
            rateLimitWsUpgrades: 10,
        })

        expect(limiter.canOpen('127.0.0.1', '/pad:text')).toBe(true)
        limiter.open('127.0.0.1', '/pad:text')
        expect(limiter.canOpen('127.0.0.2', '/pad:text')).toBe(false)
        limiter.close('127.0.0.1', '/pad:text')
        expect(limiter.canOpen('127.0.0.2', '/pad:text')).toBe(true)
    })

    test('limits websocket messages and bytes per ip', async () => {
        const limiter = createRateLimiter({
            maxRoomClients: 10,
            rateLimitWindowMs: 60_000,
            rateLimitWsUpgrades: 10,
        })

        for (let index = 0; index < MAX_WS_MESSAGES_PER_WINDOW; index += 1) {
            expect(await limiter.canAcceptMessage('127.0.0.1', 1)).toBe(true)
        }

        expect(await limiter.canAcceptMessage('127.0.0.1', 1)).toBe(false)
    })

    test('limits pad writes per room', async () => {
        const limiter = createRateLimiter({
            maxRoomClients: 10,
            rateLimitWindowMs: 60_000,
            rateLimitWsUpgrades: 10,
        })

        for (let index = 0; index < MAX_PAD_WRITES_PER_WINDOW; index += 1) {
            expect(await limiter.canWritePad('/pad:text')).toBe(true)
        }

        expect(await limiter.canWritePad('/pad:text')).toBe(false)
    })
})
