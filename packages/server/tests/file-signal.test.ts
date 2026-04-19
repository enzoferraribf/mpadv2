import { describe, expect, test } from 'bun:test'
import { readServerRoomMessage } from '@mpad/protocol/room-message-codec'
import type { ServerWebSocket } from 'bun'
import { routeLiveFileSignal } from '#/live-files/application/live-file-room-service'
import type { WsData } from '#/transport/ws-data'

describe('file signal routing', () => {
    test('sends the signal to the target peer in the file room', () => {
        const sender = createSocket(1)
        const target = createSocket(2)
        const other = createSocket(3)
        const room = {
            clients: new Set([sender, target, other]),
        }

        routeLiveFileSignal(room, sender, {
            targetPeerId: 2,
            signal: {
                kind: 'signal',
                fileId: 'file-1',
                data: '{"type":"offer","sdp":"hello"}',
            },
        })

        expect(target.sent).toHaveLength(1)
        expect(other.sent).toHaveLength(0)

        const message = readServerRoomMessage(target.sent[0]!)
        expect(message).toEqual({
            kind: 'file-signal',
            signal: {
                sourcePeerId: 1,
                signal: {
                    kind: 'signal',
                    fileId: 'file-1',
                    data: '{"type":"offer","sdp":"hello"}',
                },
            },
        })
    })

    test('ignores file signals when the target peer is missing', () => {
        const sender = createSocket(1)
        const target = createSocket(2)
        const room = {
            clients: new Set([sender]),
        }

        routeLiveFileSignal(room, sender, {
            targetPeerId: 2,
            signal: { kind: 'request', fileId: 'file-1' },
        })

        expect(target.sent).toHaveLength(0)
    })
})

function createSocket(awarenessClientId: number) {
    const sent: Uint8Array[] = []

    return {
        data: {
            roomName: '/pad:files',
            roomKind: 'files',
            awarenessClientId,
        },
        sent,
        sendBinary(data: Buffer) {
            sent.push(new Uint8Array(data))
        },
    } as unknown as ServerWebSocket<WsData> & { sent: Uint8Array[] }
}
