import { createInMemoryDocRoomRegistry } from '../pad-doc/infrastructure/in-memory-doc-room-registry'
import { postgresDocRepository } from '../pad-doc/infrastructure/postgres-doc-repository'
import { createInMemoryFileRoomRegistry } from '../live-files/infrastructure/in-memory-file-room-registry'

export const appContext = {
    docRepository: postgresDocRepository,
    docRoomRegistry: createInMemoryDocRoomRegistry(),
    fileRoomRegistry: createInMemoryFileRoomRegistry(),
}
