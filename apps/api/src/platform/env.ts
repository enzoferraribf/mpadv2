import {
    MAX_RELATED_PADS,
    MAX_ROOM_CLIENTS,
    MAX_WS_UPGRADES_PER_WINDOW,
} from '@mpad/core/pad-limits'
import { z } from 'zod'
import type { ClientIpSource } from '#/platform/http/client-ip'

const serverEnvSchema = z.object({
    CLIENT_ORIGIN: z.string().optional(),
    CLIENT_IP_SOURCE: z
        .enum(['cloudflare', 'direct', 'proxy'])
        .default('cloudflare'),
    DATABASE_URL: z.string().min(1).optional(),
    MAX_RELATED_PADS: z.coerce
        .number()
        .int()
        .positive()
        .default(MAX_RELATED_PADS),
    MAX_ROOM_CLIENTS: z.coerce
        .number()
        .int()
        .positive()
        .default(MAX_ROOM_CLIENTS),
    NODE_ENV: z.string().optional(),
    PORT: z.coerce.number().int().positive().default(4000),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_WS_UPGRADES: z.coerce
        .number()
        .int()
        .positive()
        .default(MAX_WS_UPGRADES_PER_WINDOW),
    TRUST_PROXY_HEADERS: z
        .string()
        .optional()
        .transform((value, context) => {
            if (value === undefined || value.trim() === '') return false
            const normalized = value.trim().toLowerCase()
            if (normalized === 'true' || normalized === '1') return true
            if (normalized === 'false' || normalized === '0') return false

            context.addIssue({
                code: 'custom',
                message: `Invalid TRUST_PROXY_HEADERS: ${value}`,
            })
            return z.NEVER
        }),
})

export type ServerConfig = {
    clientIp: {
        source: ClientIpSource
        trustProxyHeaders: boolean
        allowDevelopmentFallback: boolean
    }
    clientOrigin: string | null
    limits: {
        maxRelatedPads: number
        maxRoomClients: number
        rateLimitWindowMs: number
        rateLimitWsUpgrades: number
    }
    port: number
}

export function readServerConfig(
    env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
    const parsed = serverEnvSchema.parse(env)
    const clientOrigin = readOptionalOrigin(parsed.CLIENT_ORIGIN ?? null)
    const isProduction = isProductionEnv(parsed.NODE_ENV)
    if (isProduction && clientOrigin === null) {
        throw new Error('CLIENT_ORIGIN is required when NODE_ENV=production.')
    }

    return {
        clientIp: {
            source: parsed.CLIENT_IP_SOURCE,
            trustProxyHeaders: parsed.TRUST_PROXY_HEADERS,
            allowDevelopmentFallback: !isProduction,
        },
        clientOrigin,
        limits: {
            maxRelatedPads: parsed.MAX_RELATED_PADS,
            maxRoomClients: parsed.MAX_ROOM_CLIENTS,
            rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
            rateLimitWsUpgrades: parsed.RATE_LIMIT_WS_UPGRADES,
        },
        port: parsed.PORT,
    }
}

export function readDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
    const value = serverEnvSchema.parse(env).DATABASE_URL
    if (!value) {
        throw new Error(
            'Missing DATABASE_URL. Start Postgres and set DATABASE_URL before running the server.',
        )
    }

    return value
}

function readOptionalOrigin(value: string | null) {
    if (!value) return null

    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`CLIENT_ORIGIN must use http or https: ${value}`)
    }

    return url.origin
}

function isProductionEnv(value: string | undefined) {
    return value?.trim() === 'production'
}
