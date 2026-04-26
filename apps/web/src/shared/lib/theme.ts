export type AppVisualTone = 'light' | 'dark'

export const APP_THEME_STORAGE_KEY = 'mpad.theme'

export function resolveAppVisualTone(theme: string | undefined): AppVisualTone {
    return theme === 'light' ? 'light' : 'dark'
}
