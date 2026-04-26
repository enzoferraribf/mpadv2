import type { LiveFilesRoom } from './room'

export interface FileRoomRegistry {
    delete: (roomName: string) => void
    get: (roomName: string) => LiveFilesRoom | undefined
    set: (roomName: string, room: LiveFilesRoom) => void
}
