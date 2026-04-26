import {
    MAX_PAD_WRITES_PER_WINDOW,
    MAX_WS_ACTIVE_PER_IP,
    MAX_WS_MESSAGES_PER_WINDOW,
    MAX_WS_MESSAGE_BYTES_PER_WINDOW,
} from '@mpad/core/pad-limits'
import { RateLimiterMemory } from 'rate-limiter-flexible'

export type RateLimitConfig = {
    maxRoomClients: number
    rateLimitWindowMs: number
    rateLimitWsUpgrades: number
}

export type RateLimiter = ReturnType<typeof createRateLimiter>

export function createRateLimiter(config: RateLimitConfig) {
    const duration = Math.max(1, Math.ceil(config.rateLimitWindowMs / 1000))
    const capacity = createRoomCapacityTracker(config)
    const upgrades = new RateLimiterMemory({
        keyPrefix: 'ws-upgrade',
        points: config.rateLimitWsUpgrades,
        duration,
    })
    const messages = new RateLimiterMemory({
        keyPrefix: 'ws-message',
        points: MAX_WS_MESSAGES_PER_WINDOW,
        duration,
    })
    const messageBytes = new RateLimiterMemory({
        keyPrefix: 'ws-message-bytes',
        points: MAX_WS_MESSAGE_BYTES_PER_WINDOW,
        duration,
    })
    const writes = new RateLimiterMemory({
        keyPrefix: 'pad-write',
        points: MAX_PAD_WRITES_PER_WINDOW,
        duration,
    })

    return {
        canUpgrade(ip: string) {
            return consume(upgrades, ip)
        },
        canOpen(ip: string, roomName: string) {
            return capacity.canOpen(ip, roomName)
        },
        open(ip: string, roomName: string) {
            capacity.open(ip, roomName)
        },
        close(ip: string, roomName: string) {
            capacity.close(ip, roomName)
        },
        async canAcceptMessage(ip: string, bytes: number) {
            const allowedMessages = await consume(messages, ip)
            if (!allowedMessages) return false

            return consume(messageBytes, ip, bytes)
        },
        canWritePad(roomName: string) {
            return consume(writes, roomName)
        },
    }
}

function createRoomCapacityTracker(config: RateLimitConfig) {
    const activeByIp = new Map<string, number>()
    const activeByRoom = new Map<string, number>()

    return {
        canOpen(ip: string, roomName: string) {
            return (
                (activeByIp.get(ip) ?? 0) < MAX_WS_ACTIVE_PER_IP &&
                (activeByRoom.get(roomName) ?? 0) < config.maxRoomClients
            )
        },
        open(ip: string, roomName: string) {
            activeByIp.set(ip, (activeByIp.get(ip) ?? 0) + 1)
            activeByRoom.set(roomName, (activeByRoom.get(roomName) ?? 0) + 1)
        },
        close(ip: string, roomName: string) {
            decrement(activeByIp, ip)
            decrement(activeByRoom, roomName)
        },
    }
}

async function consume(limiter: RateLimiterMemory, key: string, points = 1) {
    try {
        await limiter.consume(key, points)
        return true
    } catch {
        return false
    }
}

function decrement(map: Map<string, number>, key: string) {
    const next = (map.get(key) ?? 0) - 1
    if (next <= 0) {
        map.delete(key)
        return
    }
    map.set(key, next)
}
