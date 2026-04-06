import type { PadPath, PadTreeResponse } from '@mpad/shared'
import { fetchApiJson, padApiUrl } from '@/pad-workspace/infrastructure/browser-pad-api'

export const browserWorkspaceNavigationQuery = {
    listRelatedPads(path: PadPath, signal: AbortSignal) {
        return fetchApiJson<PadTreeResponse>(padApiUrl(path, '/related'), signal)
    },
}
