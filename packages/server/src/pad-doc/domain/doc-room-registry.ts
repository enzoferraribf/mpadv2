import type { PadDocRoom } from '../../collab/infrastructure/doc-room'

export interface DocRoomRegistry {
    delete: (roomName: string) => void
    get: (roomName: string) => PadDocRoom | undefined
    set: (roomName: string, room: PadDocRoom) => void
    values: () => Iterable<PadDocRoom>
}
