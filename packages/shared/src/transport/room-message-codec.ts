import type { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import type { Doc } from 'yjs'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import type { InboundFileSignal, OutboundFileSignal } from '../domain/file-session'
import { assert, assertNever } from '../domain/assert'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1
const MESSAGE_FILE_SIGNAL = 2

export type SyncRoomMessage = { kind: 'sync'; data: Uint8Array }
export type AwarenessRoomMessage = { kind: 'awareness'; data: Uint8Array }
export type RoomDocMessage = SyncRoomMessage | AwarenessRoomMessage

export type ClientRoomMessage =
    | RoomDocMessage
    | { kind: 'file-signal'; signal: OutboundFileSignal }

export type ServerRoomMessage =
    | RoomDocMessage
    | { kind: 'file-signal'; signal: InboundFileSignal }

export function readClientRoomMessage(data: Uint8Array): ClientRoomMessage {
    const decoder = decoding.createDecoder(data)
    const type = decoding.readVarUint(decoder)

    if (type === MESSAGE_SYNC) return { kind: 'sync', data }
    if (type === MESSAGE_AWARENESS) return { kind: 'awareness', data }
    if (type === MESSAGE_FILE_SIGNAL) {
        return {
            kind: 'file-signal',
            signal: JSON.parse(decoding.readVarString(decoder)) as OutboundFileSignal,
        }
    }

    throw new Error(`Unknown room message type: ${type}`)
}

export function readServerRoomMessage(data: Uint8Array): ServerRoomMessage {
    const decoder = decoding.createDecoder(data)
    const type = decoding.readVarUint(decoder)

    if (type === MESSAGE_SYNC) return { kind: 'sync', data }
    if (type === MESSAGE_AWARENESS) return { kind: 'awareness', data }
    if (type === MESSAGE_FILE_SIGNAL) {
        return {
            kind: 'file-signal',
            signal: JSON.parse(decoding.readVarString(decoder)) as InboundFileSignal,
        }
    }

    throw new Error(`Unknown room message type: ${type}`)
}

export function encodeClientRoomMessage(message: ClientRoomMessage) {
    if (message.kind === 'sync' || message.kind === 'awareness') return message.data
    if (message.kind === 'file-signal') return encodeJsonMessage(MESSAGE_FILE_SIGNAL, message.signal)
    return assertNever(message)
}

export function encodeServerRoomMessage(message: ServerRoomMessage) {
    if (message.kind === 'sync' || message.kind === 'awareness') return message.data
    if (message.kind === 'file-signal') return encodeJsonMessage(MESSAGE_FILE_SIGNAL, message.signal)
    return assertNever(message)
}

export function createDocUpdateMessage(update: Uint8Array): SyncRoomMessage {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeUpdate(encoder, update)
    return { kind: 'sync', data: encoding.toUint8Array(encoder) }
}

export function createSyncStep1Message(doc: Doc): SyncRoomMessage {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(encoder, doc)
    return { kind: 'sync', data: encoding.toUint8Array(encoder) }
}

export function replyToSyncMessage(doc: Doc, data: Uint8Array, origin: unknown) {
    const decoder = decoding.createDecoder(data)
    const encoder = encoding.createEncoder()
    const type = decoding.readVarUint(decoder)
    assert(type === MESSAGE_SYNC, 'Expected sync room message')
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.readSyncMessage(decoder, encoder, doc, origin)
    if (encoding.length(encoder) <= 1) return null
    return { kind: 'sync', data: encoding.toUint8Array(encoder) } satisfies SyncRoomMessage
}

export function createAwarenessMessage(awareness: Awareness, clientIds: number[]): AwarenessRoomMessage {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds))
    return { kind: 'awareness', data: encoding.toUint8Array(encoder) }
}

export function applyAwarenessMessage(awareness: Awareness, data: Uint8Array, origin: unknown) {
    const decoder = decoding.createDecoder(data)
    const type = decoding.readVarUint(decoder)
    assert(type === MESSAGE_AWARENESS, 'Expected awareness room message')
    awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), origin)
}

function encodeJsonMessage(type: number, value: object) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, type)
    encoding.writeVarString(encoder, JSON.stringify(value))
    return encoding.toUint8Array(encoder)
}
