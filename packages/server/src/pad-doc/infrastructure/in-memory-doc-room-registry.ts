import type { PadDocRoom } from '#/collab/infrastructure/doc-room'
import type { DocRoomRegistry } from '#/pad-doc/domain/doc-room-registry'

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
