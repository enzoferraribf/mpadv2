import {
    appendPadDocRevision,
    createPadDocCheckpoint,
    listPadDocRevisions,
    loadPadDoc,
    loadPadDocRevisionBytes,
    readPadDocRevisionText,
} from '../../collab/infrastructure/doc-store'
import type { DocRepository } from '../domain/doc-repository'

export const postgresDocRepository: DocRepository = {
    appendRevision: appendPadDocRevision,
    createCheckpoint: createPadDocCheckpoint,
    listRevisions: listPadDocRevisions,
    loadDoc: loadPadDoc,
    loadRevisionBytes: loadPadDocRevisionBytes,
    readRevisionText: readPadDocRevisionText,
}
