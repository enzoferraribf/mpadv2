import type { PadDocRoom } from './doc-room'

export interface DocRoomRegistry {
    delete: (roomName: string) => void
    get: (roomName: string) => PadDocRoom | undefined
    set: (roomName: string, room: PadDocRoom) => void
    values: () => Iterable<PadDocRoom>
}
