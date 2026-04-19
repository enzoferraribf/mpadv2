import {
    CORS_ALLOWED_HEADERS,
    CORS_ALLOWED_METHODS,
    readCorsOrigin,
} from '#/infrastructure/origin'

type HeaderPolicyInput = {
    appOrigin: string | null
    requestOrigin?: string | null
}

export function applyApiResponseHeaders(
    response: Response,
    input: HeaderPolicyInput,
) {
    applyBaseSecurityHeaders(response)

    const corsOrigin = readCorsOrigin(
        input.appOrigin,
        input.requestOrigin ?? null,
    )
    if (!corsOrigin) return response

    response.headers.set('Access-Control-Allow-Origin', corsOrigin)
    response.headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS)
    response.headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS)
    appendVaryHeader(response, 'Origin')
    return response
}

export function applyClientResponseHeaders(
    response: Response,
    appOrigin: string | null,
) {
    applyBaseSecurityHeaders(response)
    response.headers.set(
        'Content-Security-Policy',
        createContentSecurityPolicy(appOrigin),
    )
    return response
}

export function applyErrorResponseHeaders(response: Response) {
    applyBaseSecurityHeaders(response)
    return response
}

function applyBaseSecurityHeaders(response: Response) {
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set(
        'Permissions-Policy',
        [
            'browsing-topics=()',
            'camera=()',
            'geolocation=()',
            'microphone=()',
            'payment=()',
            'usb=()',
        ].join(', '),
    )
}

function createContentSecurityPolicy(appOrigin: string | null) {
    const connectSources = [`'self'`]
    if (appOrigin) {
        connectSources.push(appOrigin, toWebSocketOrigin(appOrigin))
    } else {
        connectSources.push('ws:', 'wss:')
    }

    return [
        `default-src 'self'`,
        `script-src 'self'`,
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
        `font-src 'self' https://fonts.gstatic.com data:`,
        `img-src 'self' https: data: blob:`,
        `connect-src ${connectSources.join(' ')}`,
        `object-src 'none'`,
        `base-uri 'none'`,
        `frame-ancestors 'none'`,
    ].join('; ')
}

function toWebSocketOrigin(origin: string) {
    const url = new URL(origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.origin
}

function appendVaryHeader(response: Response, value: string) {
    const existing = response.headers.get('Vary')
    if (!existing) {
        response.headers.set('Vary', value)
        return
    }

    const values = existing
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    if (values.includes(value)) return
    response.headers.set('Vary', [...values, value].join(', '))
}
