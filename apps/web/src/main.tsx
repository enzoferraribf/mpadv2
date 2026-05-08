import { RouterProvider, createRouter } from '@tanstack/react-router'
import '@fontsource-variable/fira-code'
import '@fontsource-variable/nunito-sans'
import { createRoot } from 'react-dom/client'
import { routeTree } from './routeTree.gen'
import './styles/globals.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

createRoot(document.getElementById('root')!).render(
    <RouterProvider router={router} />,
)
