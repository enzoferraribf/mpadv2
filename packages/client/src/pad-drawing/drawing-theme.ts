import type { AppVisualTone } from '@/lib/theme'

export type DrawingThemePreference = 'app' | 'light' | 'dark'
export type DrawingTheme = 'light' | 'dark'

const STORAGE_KEY = 'mpad.excalidraw-theme'

export function readDrawingThemePreference(): DrawingThemePreference {
    if (typeof window === 'undefined') return 'app'

    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isDrawingThemePreference(stored) ? stored : 'app'
}

export function writeDrawingThemePreference(
    preference: DrawingThemePreference,
) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, preference)
}

export function resolveDrawingThemePreference(
    preference: DrawingThemePreference,
    visualTone: AppVisualTone,
): DrawingTheme {
    if (preference === 'app') return visualTone
    return preference
}

function isDrawingThemePreference(
    value: string | null,
): value is DrawingThemePreference {
    return value === 'app' || value === 'light' || value === 'dark'
}
