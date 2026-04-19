import { LandingPage } from '@/landing/view/landing-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    component: LandingPage,
})
