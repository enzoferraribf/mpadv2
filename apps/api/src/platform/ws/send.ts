import {
    MAX_WS_BUFFERED_BYTES,
    WS_POLICY_CLOSE_CODE,
} from '@mpad/core/pad-limits'
import type { ServerWebSocket } from 'bun'
import type { WsData } from './data'

export function sendSocketBytes(
    socket: ServerWebSocket<WsData>,
    bytes: Uint8Array,
) {
    const bufferedBytes = socket.sendBinary(Buffer.from(bytes))
    if (bufferedBytes > MAX_WS_BUFFERED_BYTES) {
        socket.close(WS_POLICY_CLOSE_CODE, 'Backpressure limit exceeded')
    }
}
