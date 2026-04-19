import {
    fetchApiJson,
    padApiUrl,
} from '@/pad-workspace/infrastructure/browser-pad-api'
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
