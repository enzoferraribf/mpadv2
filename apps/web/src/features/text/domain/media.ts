export function sanitizeMarkdownMediaSource(value: string | null | undefined) {
    if (!value) return null

    const normalized = unwrapMarkdownUrl(value.trim())
    if (!normalized || normalized.startsWith('//')) return null
    if (normalized.startsWith('https:')) return normalized
    if (normalized.startsWith('data:')) return normalized
    if (normalized.startsWith('blob:')) return normalized
    if (hasUrlScheme(normalized)) return null
    return normalized
}

function unwrapMarkdownUrl(value: string) {
    if (value.startsWith('<') && value.endsWith('>')) {
        return value.slice(1, -1).trim()
    }

    return value
}

function hasUrlScheme(value: string) {
    return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)
}
