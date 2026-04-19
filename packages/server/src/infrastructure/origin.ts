export function allowedCorsOrigin(appOrigin: string | null) {
    return appOrigin ?? '*'
}

export function isAllowedWebSocketOrigin(
    appOrigin: string | null,
    requestOrigin: string | null,
) {
    if (appOrigin === null) return true
    return requestOrigin === appOrigin
}
