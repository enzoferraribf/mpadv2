import type { PadRoomKind } from '@mpad/shared'

export type WsData = {
    roomName: string
    roomKind: PadRoomKind
    awarenessClientId: number
}
