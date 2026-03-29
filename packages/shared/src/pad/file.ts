export type LiveFileMeta = {
    id: string
    name: string
    mimeType: string
    sizeBytes: number
    createdAt: string
}

export type LiveFileOwner = {
    peerId: number
    peerName: string
}

export type LiveFileTransfer =
    | {
        kind: 'uploading'
        peerId: number
        sentBytes: number
    }
    | {
        kind: 'downloading'
        peerId: number
        receivedBytes: number
    }

export type LiveFileState =
    | {
        kind: 'available'
        meta: LiveFileMeta
        owners: LiveFileOwner[]
        isLocal: boolean
    }
    | {
        kind: 'transferring'
        meta: LiveFileMeta
        owners: LiveFileOwner[]
        isLocal: boolean
        transfer: LiveFileTransfer
    }

export type FileSignal =
    | { kind: 'request'; fileId: string }
    | { kind: 'signal'; fileId: string; data: string }
    | { kind: 'cancel'; fileId: string }
    | { kind: 'complete'; fileId: string }
    | { kind: 'reject'; fileId: string; reason: string }

export type OutboundFileSignal = {
    targetPeerId: number
    signal: FileSignal
}

export type InboundFileSignal = {
    sourcePeerId: number
    signal: FileSignal
}

export function assertLiveFileAllowed(input: {
    fileSize: number
    fileCount: number
    totalBytes: number
    maxFileBytes: number
    maxFileCount: number
    maxTotalBytes: number
}) {
    if (input.fileSize > input.maxFileBytes) throw new Error(`File exceeds ${input.maxFileBytes / (1024 * 1024)}MB`)
    if (input.fileCount >= input.maxFileCount) throw new Error('Peer file count limit reached')
    if (input.totalBytes + input.fileSize > input.maxTotalBytes) throw new Error('Peer file size limit reached')
}
