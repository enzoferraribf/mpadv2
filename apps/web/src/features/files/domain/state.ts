import type { LocalFile } from '@/features/files/application/store'
import { assertNever } from '@mpad/core/assert'
import type { LiveFileTransfer } from '@mpad/protocol/live-files'

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
    | {
          kind: 'download-progress'
          fileId: string
          peerId: number
          receivedBytes: number
      }
    | { kind: 'download-completed'; localFile: LocalFile }
    | { kind: 'upload-started'; fileId: string; peerId: number }
    | {
          kind: 'upload-progress'
          fileId: string
          peerId: number
          sentBytes: number
      }
    | { kind: 'transfer-cleared'; fileId: string }

export function createFileMachineState(): FileMachineState {
    return {
        localFiles: {},
        transfers: {},
    }
}

export function reduceFileMachine(
    state: FileMachineState,
    event: FileMachineEvent,
): FileMachineState {
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

export function totalLocalFileBytes(files: LocalFileMap) {
    return Object.values(files).reduce(
        (total, file) => total + file.meta.sizeBytes,
        0,
    )
}
