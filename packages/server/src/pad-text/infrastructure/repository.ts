import type { PadPath } from '@mpad/shared'
import { listPadDocRevisions, loadPadDocRevisionBytes, readPadDocRevisionText } from '../../collab/infrastructure/doc-store'

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
