import {
    fetchApiBytes,
    fetchApiJson,
    padApiUrl,
    postApiJson,
} from '@/pad-workspace/infrastructure/browser-pad-api'
import type { PadPath } from '@mpad/core/pad-path'
import type {
    PadTextHistoryResponse,
    PadTextRevisionResponse,
} from '@mpad/protocol/http'
import type { PadDocRevisionSummary } from '@mpad/protocol/pad-text-history'

export type PadTextHistoryEntry = PadTextHistoryResponse[number]
export type PadTextHistoryRevision = PadTextRevisionResponse

export const browserPadTextHistoryQuery = {
    listRevisions(path: PadPath, signal: AbortSignal) {
        return fetchApiJson<PadTextHistoryResponse>(
            padApiUrl(path, '/text/history'),
            signal,
        )
    },
    readRevision(path: PadPath, revisionId: number, signal: AbortSignal) {
        return fetchApiJson<PadTextRevisionResponse>(
            padApiUrl(path, `/text/history/${revisionId}`),
            signal,
        )
    },
    readRevisionUpdate(path: PadPath, revisionId: number) {
        return fetchApiBytes(
            padApiUrl(path, `/text/history/${revisionId}/update`),
        )
    },
}

export const browserPadTextHistoryCommand = {
    revertRevision(path: PadPath, revisionId: number) {
        return postApiJson<PadDocRevisionSummary>(
            padApiUrl(path, `/text/history/${revisionId}/revert`),
        )
    },
}
