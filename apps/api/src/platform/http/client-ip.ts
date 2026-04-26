import { isIP } from 'node:net'

export type ClientIpSource = 'cloudflare' | 'direct' | 'proxy'

export type ClientIpPolicy = {
    source: ClientIpSource
    trustProxyHeaders: boolean
    allowDevelopmentFallback: boolean
}

export function readTrustedClientIp(request: Request, policy: ClientIpPolicy) {
    const cloudflareIp = readValidIp(request.headers.get('cf-connecting-ip'))
    if (policy.source === 'cloudflare' && cloudflareIp) return cloudflareIp

    if (policy.source === 'direct') {
        return 'direct'
    }

    if (policy.source === 'proxy' && policy.trustProxyHeaders) {
        const proxyIp = readProxyIp(request)
        if (proxyIp) return proxyIp
    }

    if (policy.allowDevelopmentFallback) {
        return cloudflareIp ?? readProxyIp(request) ?? 'direct'
    }

    return null
}

function readProxyIp(request: Request) {
    const realIp = readValidIp(request.headers.get('x-real-ip'))
    if (realIp) return realIp

    const forwardedFor = request.headers.get('x-forwarded-for')
    const [firstForwarded] = forwardedFor?.split(',') ?? []
    return readValidIp(firstForwarded)
}

function readValidIp(value: string | null | undefined) {
    const normalized = value?.trim()
    if (!normalized || !isIP(normalized)) return null

    return normalized
}
