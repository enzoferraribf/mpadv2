import { PadPage } from '@/pad-workspace/view/pad-page'
import { padPath } from '@mpad/core/pad-path'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$')({
    component: PadRoute,
})

function PadRoute() {
    const { _splat } = Route.useParams()
    const path = padPath(_splat ?? '')

    return <PadPage path={path} />
}
