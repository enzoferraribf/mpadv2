import type { PadRoomKind } from '@mpad/core/pad-room'

export type WsData = {
    ip: string
    roomName: string
    roomKind: PadRoomKind
    awarenessClientId: number
}
