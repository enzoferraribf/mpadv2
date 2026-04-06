import type { PadRoomKind } from '@mpad/core/pad-room'

export type WsData = {
    roomName: string
    roomKind: PadRoomKind
    awarenessClientId: number
}
