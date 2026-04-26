import { fetchApiJson, padApiUrl } from '@/shared/realtime/client'
import type { PadPath } from '@mpad/core/pad-path'
import type { PadTreeResponse } from '@mpad/protocol/http'

export const browserWorkspaceNavigationQuery = {
    listRelatedPads(path: PadPath, signal: AbortSignal) {
        return fetchApiJson<PadTreeResponse>(
            padApiUrl(path, '/related'),
            signal,
        )
    },
}
