export type AppVisualTone = 'light' | 'dark'

export function resolveAppVisualTone(theme: string | undefined): AppVisualTone {
    return theme === 'light' ? 'light' : 'dark'
}
