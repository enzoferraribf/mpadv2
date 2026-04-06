import type { PadPath } from '@mpad/shared'
import {
    listPadTextRevisions,
    readPadTextRevision,
    readPadTextRevisionUpdate,
} from '../infrastructure/repository'
import { revertPadDocRoomToUpdate } from '../../collab/infrastructure/doc-room-service'

export async function revertPadTextRevision(path: PadPath, revisionId: number) {
    const revision = await readPadTextRevision(path, revisionId)
    if (!revision) return null

    const update = await readPadTextRevisionUpdate(path, revisionId)
    if (!update) return null

    return revertPadDocRoomToUpdate({
        path,
        kind: 'text',
        revertedFromRevisionId: revisionId,
        revertedFromRevisionNumber: revision.revisionNumber,
        update,
    })
}

export {
    listPadTextRevisions,
    readPadTextRevision,
    readPadTextRevisionUpdate,
}
