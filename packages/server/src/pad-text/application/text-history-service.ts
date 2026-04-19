import type { PadPath } from '@mpad/core/pad-path'
import type { ServerRuntime } from '#/bootstrap/runtime'
import { revertPadDocRoomToUpdate } from '#/collab/infrastructure/doc-room-service'

export function listPadTextRevisions(runtime: ServerRuntime, path: PadPath) {
    return runtime.docRepository.listRevisions(path, 'text')
}

export function readPadTextRevision(
    runtime: ServerRuntime,
    path: PadPath,
    revisionId: number,
) {
    return runtime.docRepository.readRevisionText(path, revisionId)
}

export async function readPadTextRevisionUpdate(
    runtime: ServerRuntime,
    path: PadPath,
    revisionId: number,
) {
    const revision = await readPadTextRevision(runtime, path, revisionId)
    if (!revision) return null
    return runtime.docRepository.loadRevisionBytes(path, 'text', revisionId)
}

export async function revertPadTextRevision(
    runtime: ServerRuntime,
    path: PadPath,
    revisionId: number,
) {
    const revision = await readPadTextRevision(runtime, path, revisionId)
    if (!revision) return null

    const update = await readPadTextRevisionUpdate(runtime, path, revisionId)
    if (!update) return null

    return revertPadDocRoomToUpdate(runtime, {
        path,
        kind: 'text',
        revertedFromRevisionId: revisionId,
        revertedFromRevisionNumber: revision.revisionNumber,
        update,
    })
}
