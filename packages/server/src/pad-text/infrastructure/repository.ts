import type { PadPath } from '@mmpad/shared'
import { listPadDocRevisions, readPadDocRevisionText } from '../../pad-doc/infrastructure/repository'

export function listPadTextRevisions(path: PadPath) {
    return listPadDocRevisions(path, 'text')
}

export function readPadTextRevision(path: PadPath, revisionId: number) {
    return readPadDocRevisionText(path, revisionId)
}
