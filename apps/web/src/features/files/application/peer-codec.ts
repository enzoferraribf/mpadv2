import type { FileSignal } from '@mpad/protocol/live-files'

const CONTROL_MESSAGE_KIND = 0
const CHUNK_MESSAGE_KIND = 1
const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

export type FilePeerMessage =
    | { kind: 'control'; signal: FileSignal }
    | { kind: 'chunk'; data: Uint8Array }

export function readPeerMessage(raw: unknown): FilePeerMessage {
    if (typeof raw === 'string') {
        return {
            kind: 'control',
            signal: JSON.parse(raw) as FileSignal,
        }
    }

    const bytes = toUint8Array(raw)

    if (bytes[0] === CONTROL_MESSAGE_KIND) {
        return {
            kind: 'control',
            signal: JSON.parse(
                textDecoder.decode(bytes.slice(1)),
            ) as FileSignal,
        }
    }

    if (bytes[0] === CHUNK_MESSAGE_KIND) {
        return {
            kind: 'chunk',
            data: bytes.slice(1),
        }
    }

    throw new Error(`Unknown peer payload kind: ${bytes[0]}`)
}

export function encodeControlMessage(signal: FileSignal) {
    const text = textEncoder.encode(JSON.stringify(signal))
    const bytes = new Uint8Array(text.byteLength + 1)
    bytes[0] = CONTROL_MESSAGE_KIND
    bytes.set(text, 1)
    return bytes
}

export function encodeChunkMessage(chunk: Uint8Array) {
    const bytes = new Uint8Array(chunk.byteLength + 1)
    bytes[0] = CHUNK_MESSAGE_KIND
    bytes.set(chunk, 1)
    return bytes
}

function toUint8Array(raw: unknown) {
    if (raw instanceof Uint8Array) return raw
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
    if (ArrayBuffer.isView(raw)) {
        return new Uint8Array(
            raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
        )
    }
    throw new Error('Unknown peer payload')
}
