import type { PadPath } from '@mmpad/shared'
import { listPadDocRevisions, readPadDocRevisionText } from '../../pad-doc/infrastructure/repository'
import { loadPadDocRevisionBytes } from '../../pad-doc/infrastructure/repository'

export function listPadTextRevisions(path: PadPath) {
    return listPadDocRevisions(path, 'text')
}

export function readPadTextRevision(path: PadPath, revisionId: number) {
    return readPadDocRevisionText(path, revisionId)
}

export async function readPadTextRevisionUpdate(path: PadPath, revisionId: number) {
    const revision = await readPadTextRevision(path, revisionId)
    if (!revision) return null
    return loadPadDocRevisionBytes(path, 'text', revisionId)
}
