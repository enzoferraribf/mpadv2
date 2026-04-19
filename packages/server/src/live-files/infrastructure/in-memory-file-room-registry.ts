import type { LiveFilesRoom } from '#/live-files/application/room'
import type { FileRoomRegistry } from '#/live-files/domain/file-room-registry'

export function createInMemoryFileRoomRegistry(): FileRoomRegistry {
    const rooms = new Map<string, LiveFilesRoom>()

    return {
        delete(roomName) {
            rooms.delete(roomName)
        },
        get(roomName) {
            return rooms.get(roomName)
        },
        set(roomName, room) {
            rooms.set(roomName, room)
        },
    }
}
