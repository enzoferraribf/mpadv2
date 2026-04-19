export const CORS_ALLOWED_METHODS = 'GET,POST,OPTIONS'
export const CORS_ALLOWED_HEADERS = 'Content-Type'

export function readCorsOrigin(
    appOrigin: string | null,
    requestOrigin: string | null,
) {
    if (appOrigin === null) return null
    return requestOrigin === appOrigin ? appOrigin : null
}

export function isAllowedWebSocketOrigin(
    appOrigin: string | null,
    requestOrigin: string | null,
) {
    if (appOrigin === null) return true
    return requestOrigin === appOrigin
}
