import type {
    PadDocRevisionSummary,
    PadPath,
    PadTextHistoryResponse,
    PadTextRevisionResponse,
} from '@mmpad/shared'
import {
    fetchApiBytes,
    fetchApiJson,
    padApiUrl,
    postApiJson,
} from '@/pad-workspace/infrastructure/browser-pad-api'

export type PadTextHistoryEntry = PadTextHistoryResponse[number]
export type PadTextHistoryRevision = PadTextRevisionResponse

export const browserPadTextHistoryQuery = {
    listRevisions(path: PadPath, signal: AbortSignal) {
        return fetchApiJson<PadTextHistoryResponse>(padApiUrl(path, '/text/history'), signal)
    },
    readRevision(path: PadPath, revisionId: number, signal: AbortSignal) {
        return fetchApiJson<PadTextRevisionResponse>(padApiUrl(path, `/text/history/${revisionId}`), signal)
    },
    readRevisionUpdate(path: PadPath, revisionId: number) {
        return fetchApiBytes(padApiUrl(path, `/text/history/${revisionId}/update`))
    },
}

export const browserPadTextHistoryCommand = {
    revertRevision(path: PadPath, revisionId: number) {
        return postApiJson<PadDocRevisionSummary>(padApiUrl(path, `/text/history/${revisionId}/revert`))
    },
}
