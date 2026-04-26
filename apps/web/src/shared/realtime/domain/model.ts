import type { PadRoomKind } from '@mpad/core/pad-room'
import type {
    InboundFileSignal,
    LiveFileMeta,
    OutboundFileSignal,
} from '@mpad/protocol/live-files'
import type { PadConnection } from '@mpad/protocol/pad-connection'
import type {
    ClientRoomMessage,
    ServerRoomMessage,
} from '@mpad/protocol/room-message-codec'
import type { Awareness } from 'y-protocols/awareness'
import type { Doc } from 'yjs'

export type TextAwarenessUser = {
    name: string
    color: string
    colorLight: string
}

export type FileAwarenessUser = {
    name: string
}

export type DrawingAwarenessUser = {
    name: string
    color: {
        background: string
        stroke: string
    }
}

export type DrawingAwarenessPointer = {
    x: number
    y: number
    tool: 'pointer' | 'laser'
}

export type TextAwarenessState = {
    user: TextAwarenessUser
}

export type FileAwarenessState = {
    user: FileAwarenessUser
    files: LiveFileMeta[]
}

export type DrawingAwarenessState = {
    user: DrawingAwarenessUser
    pointer: DrawingAwarenessPointer | null
    button: 'up' | 'down'
}

type FileSignalListener = (signal: InboundFileSignal) => void

export type PadRoomSession<
    TKind extends PadRoomKind,
    TLocalState extends object,
> = {
    kind: TKind
    roomName: string
    doc: Doc
    awareness: Awareness
    peerId: number
    status: PadConnection
    connectionError: string | null
    setLocalState: (state: TLocalState | null) => void
    send: (message: ClientRoomMessage) => void
    onMessage: (listener: (message: ServerRoomMessage) => void) => () => void
}

export type PadTextRoom = PadRoomSession<'text', TextAwarenessState>

export type PadFileRoom = PadRoomSession<'files', FileAwarenessState> & {
    setLocalFiles: (files: LiveFileMeta[]) => void
    sendFileSignal: (signal: OutboundFileSignal) => void
    onFileSignal: (listener: FileSignalListener) => () => void
}

export type PadDrawingRoom = PadRoomSession<'drawing', DrawingAwarenessState>
