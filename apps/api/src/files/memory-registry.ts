import type { FileRoomRegistry } from './registry'
import type { LiveFilesRoom } from './room'

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
