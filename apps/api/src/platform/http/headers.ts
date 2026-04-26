import {
    CORS_ALLOWED_HEADERS,
    CORS_ALLOWED_METHODS,
    readCorsOrigin,
} from '#/platform/http/origin'

type HeaderPolicyInput = {
    clientOrigin: string | null
    requestOrigin?: string | null
}

export function applyApiResponseHeaders(
    response: Response,
    input: HeaderPolicyInput,
) {
    applyBaseSecurityHeaders(response)

    const corsOrigin = readCorsOrigin(
        input.clientOrigin,
        input.requestOrigin ?? null,
    )
    if (!corsOrigin) return response

    response.headers.set('Access-Control-Allow-Origin', corsOrigin)
    response.headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS)
    response.headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS)
    appendVaryHeader(response, 'Origin')
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
