export const CORS_ALLOWED_METHODS = 'GET,OPTIONS'
export const CORS_ALLOWED_HEADERS = 'Content-Type'

export function readCorsOrigin(
    clientOrigin: string | null,
    requestOrigin: string | null,
) {
    if (clientOrigin === null) return null
    return requestOrigin === clientOrigin ? clientOrigin : null
}

export function isAllowedWebSocketOrigin(
    clientOrigin: string | null,
    requestOrigin: string | null,
) {
    if (clientOrigin === null) return false
    return requestOrigin === clientOrigin
}
