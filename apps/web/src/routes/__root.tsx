import { Toaster } from '@/features/workspace'
import { APP_THEME_STORAGE_KEY } from '@/shared/lib/theme'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'

export const Route = createRootRoute({
    component: RootLayout,
})

function RootLayout() {
    return (
        <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableColorScheme
            enableSystem
            storageKey={APP_THEME_STORAGE_KEY}
        >
            <Outlet />
            <Toaster />
        </ThemeProvider>
    )
}
