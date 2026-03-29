import { createFileRoute } from '@tanstack/react-router'
import { padPath } from '@mmpad/shared'
import { PadPage } from '@/app/pad-page'

export const Route = createFileRoute('/$')({
    component: PadRoute,
})

function PadRoute() {
    const { _splat } = Route.useParams()
    return <PadPage path={padPath(_splat ?? '')} />
}
