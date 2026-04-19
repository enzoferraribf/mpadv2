import type { FileSignal, LiveFileMeta } from '@mpad/protocol/live-files'
import type { Instance as PeerInstance, SignalData } from 'simple-peer'
import Peer from 'simple-peer/simplepeer.min.js'
import {
    type DownloadTarget,
    type LocalFile,
    createDownloadTarget,
    readLocalFileChunks,
} from './local-file-store'

const FILE_CHUNK_BYTES = 16 * 1024
const MAX_BUFFERED_AMOUNT = 256 * 1024
const CONTROL_MESSAGE_KIND = 0
const CHUNK_MESSAGE_KIND = 1

export type FilePeerSession = {
    peer: PeerInstance
    fileId: string
    peerId: number
}

type OpenFilePeerInput = {
    initiator: boolean
    fileId: string
    peerId: number
    meta: LiveFileMeta
    localFile: LocalFile | null
    onSignal: (signal: SignalData) => void
    onDownloadProgress: (receivedBytes: number) => void
    onDownloadComplete: (localFile: LocalFile) => void
    onUploadProgress: (sentBytes: number) => void
    onError: (error: Error) => void
    onClose: () => void
}

export function openFilePeer(input: OpenFilePeerInput): FilePeerSession {
    const peer = new Peer({
        initiator: input.initiator,
        trickle: false,
        config: { iceServers: [] },
    })
    const trackedPeer = peer as PeerInstance & { destroyed?: boolean }

    let receivedBytes = 0
    let settled = false
    let downloadComplete = false
    let queue = Promise.resolve()
    let downloadTargetPromise: Promise<DownloadTarget> | null = null

    function getDownloadTarget() {
        downloadTargetPromise ??= createDownloadTarget(input.meta)
        return downloadTargetPromise
    }

    async function abortDownloadTarget() {
        if (downloadComplete || !downloadTargetPromise) return

        const target = await downloadTargetPromise.catch(() => null)
        if (target) await target.abort()
    }

    async function finish(error?: unknown) {
        if (settled) return
        settled = true
        await abortDownloadTarget()
        if (error !== undefined) input.onError(asError(error))
        if (!trackedPeer.destroyed) trackedPeer.destroy()
        input.onClose()
    }

    peer.on('signal', (signal) => input.onSignal(signal))

    peer.on('data', (raw) => {
        queue = queue
            .then(async () => {
                const message = readPeerMessage(raw)

                if (message.kind === 'control') {
                    if (message.signal.kind === 'complete') {
                        const target = await getDownloadTarget()
                        const localFile = await target.complete()
                        downloadComplete = true
                        input.onDownloadComplete(localFile)
                        return
                    }

                    if (
                        message.signal.kind === 'cancel' ||
                        message.signal.kind === 'reject'
                    ) {
                        await finish()
                        return
                    }

                    throw new Error(
                        `Unexpected peer control: ${message.signal.kind}`,
                    )
                }

                const target = await getDownloadTarget()
                await target.write(message.data)
                receivedBytes += message.data.byteLength
                input.onDownloadProgress(receivedBytes)
            })
            .catch((error) => finish(error))
    })

    peer.on('connect', () => {
        if (!input.localFile) return
        void sendFile(
            peer,
            input.localFile,
            input.fileId,
            input.onUploadProgress,
        ).catch((error) => finish(error))
    })

    peer.on('close', () => {
        void finish()
    })
    peer.on('error', (error) => {
        void finish(error)
    })

    return {
        peer,
        fileId: input.fileId,
        peerId: input.peerId,
    }
}

export function applyFilePeerSignal(
    session: FilePeerSession,
    signal: SignalData,
) {
    session.peer.signal(signal)
}

export function closeFilePeer(session: FilePeerSession) {
    session.peer.destroy()
}

async function sendFile(
    peer: PeerInstance,
    localFile: LocalFile,
    fileId: string,
    onUploadProgress: (sentBytes: number) => void,
) {
    let sentBytes = 0

    for await (const chunk of readLocalFileChunks(
        localFile,
        FILE_CHUNK_BYTES,
    )) {
        while (peer.bufferSize > MAX_BUFFERED_AMOUNT) {
            await sleep(10)
        }

        peer.send(encodeChunkMessage(chunk))
        sentBytes += chunk.byteLength
        onUploadProgress(sentBytes)
    }

    peer.send(encodeControlMessage({ kind: 'complete', fileId }))
}

function readPeerMessage(raw: unknown) {
    if (typeof raw === 'string') {
        return {
            kind: 'control',
            signal: JSON.parse(raw) as FileSignal,
        } as const
    }

    const bytes = toUint8Array(raw)

    if (bytes[0] === CONTROL_MESSAGE_KIND) {
        return {
            kind: 'control',
            signal: JSON.parse(
                new TextDecoder().decode(bytes.slice(1)),
            ) as FileSignal,
        } as const
    }

    if (bytes[0] === CHUNK_MESSAGE_KIND) {
        return {
            kind: 'chunk',
            data: bytes.slice(1),
        } as const
    }

    throw new Error(`Unknown peer payload kind: ${bytes[0]}`)
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

function encodeControlMessage(signal: FileSignal) {
    const text = new TextEncoder().encode(JSON.stringify(signal))
    const bytes = new Uint8Array(text.byteLength + 1)
    bytes[0] = CONTROL_MESSAGE_KIND
    bytes.set(text, 1)
    return bytes
}

function encodeChunkMessage(chunk: Uint8Array) {
    const bytes = new Uint8Array(chunk.byteLength + 1)
    bytes[0] = CHUNK_MESSAGE_KIND
    bytes.set(chunk, 1)
    return bytes
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function asError(value: unknown) {
    return value instanceof Error ? value : new Error(String(value))
}
