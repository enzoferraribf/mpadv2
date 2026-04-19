import { Toaster } from '@/components/ui/sonner'
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
        >
            <Outlet />
            <Toaster />
        </ThemeProvider>
    )
}
