import { describe, expect, test } from 'bun:test'
import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { padPath } from '@mpad/core/pad-path'
import { padRoomName } from '@mpad/core/pad-room'
import {
    applyAwarenessMessage,
    createAwarenessMessage,
    createDocUpdateMessage,
    readServerRoomMessage,
} from '@mpad/protocol/room-message-codec'
import type { ServerWebSocket } from 'bun'
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs'
import { mergePadDoc } from '#/db/doc-repo'
import { createServerRuntime } from '#/platform/runtime/runtime'
import type { WsData } from '#/platform/ws/data'
import type { StoredPadDoc } from '#/workspace/doc-model'
import {
    flushPadDocRooms,
    getPadDocRoom,
    handlePadDocMessage,
    joinPadDocRoom,
} from '#/workspace/doc-service'

describe('pad doc compaction', () => {
    test('merges snapshot and updates into one document state', () => {
        const source = new Doc()
        const updates: Uint8Array[] = []

        source.on('update', (update) => updates.push(update))

        const text = source.getText(Y_TEXT_KEY)
        text.insert(0, 'hello')

        const snapshot = encodeStateAsUpdate(source)
        updates.length = 0

        text.insert(5, ' world')
        text.insert(11, '!')

        const merged = mergePadDoc(snapshot, updates)
        const restored = new Doc()
        applyUpdate(restored, merged)

        expect(restored.getText(Y_TEXT_KEY).toString()).toBe('hello world!')
    })

    test('keeps updates that arrive before the socket open handler finishes', async () => {
        const path = padPath('/early-message')
        const roomName = padRoomName(path, 'text')
        const runtime = createServerRuntime()
        const revisions: Uint8Array[] = []

        runtime.ensurePadExists = async () => {}
        runtime.docRepository = {
            async loadDoc(): Promise<StoredPadDoc> {
                return {
                    snapshot: null,
                    updates: [],
                    latestChunkSeq: 0,
                    headRevisionId: null,
                    headRevisionNumber: 0,
                }
            },
            async appendRevision(_path, _kind, update, eventCount) {
                revisions.push(update)
                return {
                    chunkSeq: eventCount,
                    revisionId: revisions.length,
                    revisionNumber: revisions.length,
                    createdAt: new Date(0).toISOString(),
                }
            },
            async createCheckpoint() {
                return 1
            },
        }

        const source = new Doc()
        source.getText(Y_TEXT_KEY).insert(0, 'early text')

        await handlePadDocMessage(
            runtime,
            createSocket(roomName),
            createDocUpdateMessage(encodeStateAsUpdate(source)),
        )
        await flushPadDocRooms(runtime)

        const restored = new Doc()
        for (const update of revisions) applyUpdate(restored, update)
        expect(restored.getText(Y_TEXT_KEY).toString()).toBe('early text')
    })

    test('broadcasts stale awareness removals', async () => {
        const path = padPath('/awareness-timeout')
        const roomName = padRoomName(path, 'text')
        const runtime = createMemoryRuntime()
        const sentA: Uint8Array[] = []
        const peerA = createPeerAwareness('A')
        const peerB = createPeerAwareness('B')
        const socketA = createSocket(roomName, peerA.awareness.clientID, sentA)
        const socketB = createSocket(roomName, peerB.awareness.clientID)

        await joinPadDocRoom(runtime, socketA)
        await handlePadDocMessage(
            runtime,
            socketA,
            createAwarenessMessage(peerA.awareness, [peerA.awareness.clientID]),
        )
        await joinPadDocRoom(runtime, socketB)
        await handlePadDocMessage(
            runtime,
            socketB,
            createAwarenessMessage(peerB.awareness, [peerB.awareness.clientID]),
        )

        applyAwarenessMessages(peerA.awareness, sentA)
        expect(peerA.awareness.getStates().has(peerB.awareness.clientID)).toBe(
            true,
        )

        sentA.length = 0
        const room = getPadDocRoom(runtime, roomName)
        expect(room).toBeDefined()
        awarenessProtocol.removeAwarenessStates(
            room!.awareness,
            [peerB.awareness.clientID],
            'timeout',
        )
        applyAwarenessMessages(peerA.awareness, sentA)

        expect(peerA.awareness.getStates().has(peerB.awareness.clientID)).toBe(
            false,
        )

        peerA.destroy()
        peerB.destroy()
    })
})

function createMemoryRuntime() {
    const runtime = createServerRuntime()

    runtime.ensurePadExists = async () => {}
    runtime.docRepository = {
        async loadDoc(): Promise<StoredPadDoc> {
            return {
                snapshot: null,
                updates: [],
                latestChunkSeq: 0,
                headRevisionId: null,
                headRevisionNumber: 0,
            }
        },
        async appendRevision(_path, _kind, _update, eventCount) {
            return {
                chunkSeq: eventCount,
                revisionId: 1,
                revisionNumber: 1,
                createdAt: new Date(0).toISOString(),
            }
        },
        async createCheckpoint() {
            return 1
        },
    }

    return runtime
}

function createPeerAwareness(name: string) {
    const doc = new Doc()
    const awareness = new Awareness(doc)
    awareness.setLocalState({
        user: {
            name,
            color: '#000',
            colorLight: '#0003',
        },
    })

    return {
        awareness,
        destroy() {
            awareness.destroy()
            doc.destroy()
        },
    }
}

function applyAwarenessMessages(
    awareness: Awareness,
    messages: readonly Uint8Array[],
) {
    for (const message of messages) {
        const roomMessage = readServerRoomMessage(message)
        if (roomMessage.kind === 'awareness') {
            applyAwarenessMessage(awareness, roomMessage.data, 'remote')
        }
    }
}

function createSocket(
    roomName: string,
    awarenessClientId = 1,
    sentMessages: Uint8Array[] = [],
): ServerWebSocket<WsData> {
    return {
        data: {
            awarenessClientId,
            ip: '127.0.0.1',
            roomKind: 'text',
            roomName,
        },
        close() {},
        sendBinary(data: Uint8Array) {
            sentMessages.push(new Uint8Array(data))
            return 0
        },
    } as unknown as ServerWebSocket<WsData>
}
