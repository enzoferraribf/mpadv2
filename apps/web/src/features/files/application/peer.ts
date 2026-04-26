import type { FileSignal, LiveFileMeta } from '@mpad/protocol/live-files'
import type { Instance as PeerInstance, SignalData } from 'simple-peer'
import Peer from 'simple-peer/simplepeer.min.js'
import {
    encodeChunkMessage,
    encodeControlMessage,
    readPeerMessage,
} from './peer-codec'
import {
    type DownloadTarget,
    type LocalFile,
    createDownloadTarget,
    readLocalFileChunks,
} from './store'

const FILE_CHUNK_BYTES = 16 * 1024
const MAX_BUFFERED_AMOUNT = 256 * 1024

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

    peer.on('signal', (signal: SignalData) => input.onSignal(signal))

    async function handlePeerMessage(raw: unknown) {
        const message = readPeerMessage(raw)

        switch (message.kind) {
            case 'control':
                await handleControlMessage(message.signal)
                return
            case 'chunk':
                await handleChunkMessage(message.data)
                return
        }
    }

    async function handleControlMessage(signal: FileSignal) {
        switch (signal.kind) {
            case 'complete': {
                const target = await getDownloadTarget()
                const localFile = await target.complete()
                downloadComplete = true
                input.onDownloadComplete(localFile)
                return
            }
            case 'cancel':
            case 'reject':
                await finish()
                return
            case 'request':
            case 'signal':
                throw new Error(`Unexpected peer control: ${signal.kind}`)
        }
    }

    async function handleChunkMessage(data: Uint8Array) {
        const target = await getDownloadTarget()
        await target.write(data)
        receivedBytes += data.byteLength
        input.onDownloadProgress(receivedBytes)
    }

    peer.on('data', (raw: unknown) => {
        queue = queue
            .then(() => handlePeerMessage(raw))
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
    peer.on('error', (error: Error) => {
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

function sleep(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function asError(value: unknown) {
    return value instanceof Error ? value : new Error(String(value))
}
