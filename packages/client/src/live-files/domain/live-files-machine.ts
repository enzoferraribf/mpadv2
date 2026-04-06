import { assertNever } from '@mpad/core/assert'
import type { LiveFileMeta, LiveFileOwner, LiveFileState, LiveFileTransfer } from '@mpad/protocol/live-files'
import type { FileAwarenessState } from '@/collab/domain/pad-room-session'
import type { LocalFile } from '@/live-files/infrastructure/local-file-store'

export type LocalFileMap = Record<string, LocalFile>
export type TransferMap = Record<string, LiveFileTransfer>

export type FileMachineState = {
    localFiles: LocalFileMap
    transfers: TransferMap
}

export type FileMachineEvent =
    | { kind: 'reset' }
    | { kind: 'local-file-added'; localFile: LocalFile }
    | { kind: 'local-file-removed'; fileId: string }
    | { kind: 'download-started'; fileId: string; peerId: number }
    | { kind: 'download-progress'; fileId: string; peerId: number; receivedBytes: number }
    | { kind: 'download-completed'; localFile: LocalFile }
    | { kind: 'upload-started'; fileId: string; peerId: number }
    | { kind: 'upload-progress'; fileId: string; peerId: number; sentBytes: number }
    | { kind: 'transfer-cleared'; fileId: string }

export function createFileMachineState(): FileMachineState {
    return {
        localFiles: {},
        transfers: {},
    }
}

export function reduceFileMachine(state: FileMachineState, event: FileMachineEvent): FileMachineState {
    if (event.kind === 'reset') return createFileMachineState()

    if (event.kind === 'local-file-added') {
        return {
            ...state,
            localFiles: {
                ...state.localFiles,
                [event.localFile.meta.id]: event.localFile,
            },
        }
    }

    if (event.kind === 'local-file-removed') {
        const next = { ...state.localFiles }
        delete next[event.fileId]
        return {
            ...state,
            localFiles: next,
        }
    }

    if (event.kind === 'download-started') {
        return {
            ...state,
            transfers: {
                ...state.transfers,
                [event.fileId]: {
                    kind: 'downloading',
                    peerId: event.peerId,
                    receivedBytes: 0,
                },
            },
        }
    }

    if (event.kind === 'download-progress') {
        return {
            ...state,
            transfers: {
                ...state.transfers,
                [event.fileId]: {
                    kind: 'downloading',
                    peerId: event.peerId,
                    receivedBytes: event.receivedBytes,
                },
            },
        }
    }

    if (event.kind === 'download-completed') {
        const nextTransfers = { ...state.transfers }
        delete nextTransfers[event.localFile.meta.id]
        return {
            localFiles: {
                ...state.localFiles,
                [event.localFile.meta.id]: event.localFile,
            },
            transfers: nextTransfers,
        }
    }

    if (event.kind === 'upload-started') {
        return {
            ...state,
            transfers: {
                ...state.transfers,
                [event.fileId]: {
                    kind: 'uploading',
                    peerId: event.peerId,
                    sentBytes: 0,
                },
            },
        }
    }

    if (event.kind === 'upload-progress') {
        return {
            ...state,
            transfers: {
                ...state.transfers,
                [event.fileId]: {
                    kind: 'uploading',
                    peerId: event.peerId,
                    sentBytes: event.sentBytes,
                },
            },
        }
    }

    if (event.kind === 'transfer-cleared') {
        const next = { ...state.transfers }
        delete next[event.fileId]
        return {
            ...state,
            transfers: next,
        }
    }

    return assertNever(event)
}

export function buildLiveFileList(
    states: Map<number, FileAwarenessState>,
    localFiles: LocalFileMap,
    transfers: TransferMap,
) {
    const grouped = new Map<string, { meta: LiveFileMeta; owners: LiveFileOwner[] }>()

    for (const [peerId, state] of states) {
        for (const meta of state.files) {
            const owner = { peerId, peerName: state.user.name }
            const current = grouped.get(meta.id)
            if (current) {
                current.owners.push(owner)
                continue
            }
            grouped.set(meta.id, { meta, owners: [owner] })
        }
    }

    return Array.from(grouped.values(), ({ meta, owners }) => {
        const transfer = transfers[meta.id]
        const isLocal = localFiles[meta.id] !== undefined
        if (transfer) return { kind: 'transferring', meta, owners, isLocal, transfer } satisfies LiveFileState
        return { kind: 'available', meta, owners, isLocal } satisfies LiveFileState
    }).sort((left, right) => left.meta.name.localeCompare(right.meta.name))
}

export function chooseRemoteOwner(owners: LiveFileOwner[], localPeerId: number) {
    return owners.find((owner) => owner.peerId !== localPeerId) ?? null
}

export function totalLocalFileBytes(files: LocalFileMap) {
    return Object.values(files).reduce((total, file) => total + file.meta.sizeBytes, 0)
}
