import { LandingPage } from '@/features/workspace'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    component: LandingPage,
})
