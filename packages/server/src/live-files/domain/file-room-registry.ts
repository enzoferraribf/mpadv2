import type { LiveFilesRoom } from '#/live-files/application/room'

export interface FileRoomRegistry {
    delete: (roomName: string) => void
    get: (roomName: string) => LiveFilesRoom | undefined
    set: (roomName: string, room: LiveFilesRoom) => void
}
