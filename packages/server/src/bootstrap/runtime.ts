import type { FileRoomRegistry } from '#/live-files/domain/file-room-registry'
import { createInMemoryFileRoomRegistry } from '#/live-files/infrastructure/in-memory-file-room-registry'
import type { DocRepository } from '#/pad-doc/domain/doc-repository'
import type { DocRoomRegistry } from '#/pad-doc/domain/doc-room-registry'
import { createInMemoryDocRoomRegistry } from '#/pad-doc/infrastructure/in-memory-doc-room-registry'
import { postgresDocRepository } from '#/pad-doc/infrastructure/postgres-doc-repository'

export type ServerRuntime = {
    docRepository: DocRepository
    docRoomRegistry: DocRoomRegistry
    fileRoomRegistry: FileRoomRegistry
}

export function createServerRuntime(): ServerRuntime {
    return {
        docRepository: postgresDocRepository,
        docRoomRegistry: createInMemoryDocRoomRegistry(),
        fileRoomRegistry: createInMemoryFileRoomRegistry(),
    }
}
