import type { DocRoomRegistry } from '../domain/doc-room-registry'
import type { PadDocRoom } from '../../collab/infrastructure/doc-room'

export function createInMemoryDocRoomRegistry(): DocRoomRegistry {
    const rooms = new Map<string, PadDocRoom>()

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
        values() {
            return rooms.values()
        },
    }
}
