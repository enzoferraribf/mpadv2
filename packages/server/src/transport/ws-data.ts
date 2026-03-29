import type { PadRoomKind } from '@mmpad/shared'

export type WsData = {
    roomName: string
    roomKind: PadRoomKind
    awarenessClientId: number
}
