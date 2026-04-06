import type { FileSignal, LiveFileMeta, LiveFileState } from '@mpad/protocol/live-files'
import type { SignalData } from 'simple-peer'
import { toast } from 'sonner'
import type { PadFileRoom } from '@/collab/domain/pad-room-session'
import {
    createFileMachineState,
    reduceFileMachine,
    chooseRemoteOwner,
    type FileMachineState,
} from '@/live-files/domain/live-files-machine'
import { createLocalFile, deleteLocalFileData, saveLocalFile, type LocalFile } from './local-file-store'
import { applyFilePeerSignal, closeFilePeer, openFilePeer, type FilePeerSession } from './file-peer'

export function handleIncomingFileSignal(input: {
    room: PadFileRoom
    sessions: Record<string, FilePeerSession>
    state: FileMachineState
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void
    sourcePeerId: number
    signal: FileSignal
}) {
    if (input.signal.kind === 'request') {
        const localFile = input.state.localFiles[input.signal.fileId]
        if (!localFile) {
            input.room.sendFileSignal({
                targetPeerId: input.sourcePeerId,
                signal: { kind: 'reject', fileId: input.signal.fileId, reason: 'File unavailable' },
            })
            return
        }

        if (input.sessions[input.signal.fileId]) {
            input.room.sendFileSignal({
                targetPeerId: input.sourcePeerId,
                signal: { kind: 'reject', fileId: input.signal.fileId, reason: 'File busy' },
            })
            return
        }

        openTransferSession({
            room: input.room,
            sessions: input.sessions,
            dispatch: input.dispatch,
            fileId: input.signal.fileId,
            peerId: input.sourcePeerId,
            initiator: false,
            localFile,
            meta: localFile.meta,
        })

        input.dispatch({ kind: 'upload-started', fileId: input.signal.fileId, peerId: input.sourcePeerId })
        return
    }

    if (input.signal.kind === 'signal') {
        const session = input.sessions[input.signal.fileId]
        if (!session) return
        applyFilePeerSignal(session, JSON.parse(input.signal.data) as SignalData)
        return
    }

    if (input.signal.kind === 'cancel' || input.signal.kind === 'reject' || input.signal.kind === 'complete') {
        closeTransferSession(input.sessions, input.dispatch, input.signal.fileId)
        return
    }

    throw new Error(`Unknown file signal: ${JSON.stringify(input.signal)}`)
}

export function deleteLocalLiveFile(input: {
    room: PadFileRoom | null
    sessions: Record<string, FilePeerSession>
    state: FileMachineState
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void
    fileId: string
}) {
    const session = input.sessions[input.fileId]
    const localFile = input.state.localFiles[input.fileId]
    if (input.room && session) {
        input.room.sendFileSignal({
            targetPeerId: session.peerId,
            signal: { kind: 'cancel', fileId: input.fileId },
        })
    }

    closeTransferSession(input.sessions, input.dispatch, input.fileId)
    input.dispatch({ kind: 'local-file-removed', fileId: input.fileId })
    if (localFile) void deleteLocalFileData(localFile)
}

export function downloadLiveFile(input: {
    room: PadFileRoom | null
    sessions: Record<string, FilePeerSession>
    state: FileMachineState
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void
    file: LiveFileState
}) {
    const localFile = input.state.localFiles[input.file.meta.id]
    if (localFile) {
        void saveLocalFile(localFile).catch((error) => toast.error((error as Error).message))
        return
    }

    if (!input.room) return
    if (input.sessions[input.file.meta.id]) return

    const owner = chooseRemoteOwner(input.file.owners, input.room.peerId)
    if (!owner) return

    openTransferSession({
        room: input.room,
        sessions: input.sessions,
        dispatch: input.dispatch,
        fileId: input.file.meta.id,
        peerId: owner.peerId,
        initiator: true,
        localFile: null,
        meta: input.file.meta,
        saveOnComplete: true,
    })

    input.dispatch({ kind: 'download-started', fileId: input.file.meta.id, peerId: owner.peerId })
    input.room.sendFileSignal({
        targetPeerId: owner.peerId,
        signal: { kind: 'request', fileId: input.file.meta.id },
    })
}

export function createPendingLocalFile(file: File) {
    return createLocalFile(file)
}

export function closeAllTransferSessions(sessions: Record<string, FilePeerSession>) {
    for (const fileId of Object.keys(sessions)) {
        const session = sessions[fileId]
        if (!session) continue
        delete sessions[fileId]
        closeFilePeer(session)
    }
}

export function createEmptyFileTransferState() {
    return createFileMachineState()
}

export async function clearLocalFiles(files: Record<string, LocalFile>) {
    await Promise.all(Object.values(files).map((file) => deleteLocalFileData(file)))
}

function openTransferSession(input: {
    room: PadFileRoom
    sessions: Record<string, FilePeerSession>
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void
    fileId: string
    peerId: number
    initiator: boolean
    localFile: LocalFile | null
    meta: LiveFileMeta
    saveOnComplete?: boolean
}) {
    let session: FilePeerSession
    session = openFilePeer({
        initiator: input.initiator,
        fileId: input.fileId,
        peerId: input.peerId,
        meta: input.meta,
        localFile: input.localFile,
        onSignal(signal) {
            input.room.sendFileSignal({
                targetPeerId: input.peerId,
                signal: {
                    kind: 'signal',
                    fileId: input.fileId,
                    data: JSON.stringify(signal),
                },
            })
        },
        onDownloadProgress(receivedBytes) {
            input.dispatch({
                kind: 'download-progress',
                fileId: input.fileId,
                peerId: input.peerId,
                receivedBytes,
            })
        },
        onDownloadComplete(localFile) {
            input.dispatch({
                kind: 'download-completed',
                localFile,
            })
            if (input.saveOnComplete) {
                void saveLocalFile(localFile).catch((error) => toast.error((error as Error).message))
            }
            closeTransferSession(input.sessions, input.dispatch, input.fileId)
        },
        onUploadProgress(sentBytes) {
            input.dispatch({
                kind: 'upload-progress',
                fileId: input.fileId,
                peerId: input.peerId,
                sentBytes,
            })
        },
        onError(error) {
            toast.error(error.message)
        },
        onClose() {
            if (input.sessions[input.fileId] !== session) return
            delete input.sessions[input.fileId]
            input.dispatch({ kind: 'transfer-cleared', fileId: input.fileId })
        },
    })

    input.sessions[input.fileId] = session
}

function closeTransferSession(
    sessions: Record<string, FilePeerSession>,
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void,
    fileId: string,
) {
    const session = sessions[fileId]
    if (session) {
        delete sessions[fileId]
        closeFilePeer(session)
    }

    dispatch({ kind: 'transfer-cleared', fileId })
}
