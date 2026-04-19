import type { PadFileRoom } from '@/collab/domain/pad-room-session'
import {
    type FileMachineState,
    chooseRemoteOwner,
    createFileMachineState,
    type reduceFileMachine,
} from '@/live-files/domain/live-files-machine'
import { assertNever } from '@mpad/core/assert'
import type {
    FileSignal,
    LiveFileMeta,
    LiveFileState,
} from '@mpad/protocol/live-files'
import type { SignalData } from 'simple-peer'
import { toast } from 'sonner'
import {
    type FilePeerSession,
    applyFilePeerSignal,
    closeFilePeer,
    openFilePeer,
} from './file-peer'
import {
    type LocalFile,
    createLocalFile,
    deleteLocalFileData,
    saveLocalFile,
} from './local-file-store'

export type FileTransferSession =
    | { kind: 'download'; peerId: number; session: FilePeerSession }
    | { kind: 'upload'; peerId: number; session: FilePeerSession }

export type FileTransferSessions = Record<string, FileTransferSession>

type OpenTransferSessionInput =
    | {
          kind: 'download'
          dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void
          fileId: string
          meta: LiveFileMeta
          peerId: number
          room: PadFileRoom
          sessions: FileTransferSessions
      }
    | {
          kind: 'upload'
          dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void
          fileId: string
          localFile: LocalFile
          meta: LiveFileMeta
          peerId: number
          room: PadFileRoom
          sessions: FileTransferSessions
      }

export function handleIncomingFileSignal(input: {
    room: PadFileRoom
    sessions: FileTransferSessions
    state: FileMachineState
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void
    sourcePeerId: number
    signal: FileSignal
}) {
    switch (input.signal.kind) {
        case 'request': {
            const localFile = input.state.localFiles[input.signal.fileId]
            if (!localFile) {
                input.room.sendFileSignal({
                    targetPeerId: input.sourcePeerId,
                    signal: {
                        kind: 'reject',
                        fileId: input.signal.fileId,
                        reason: 'File unavailable',
                    },
                })
                return
            }

            if (input.sessions[input.signal.fileId]) {
                input.room.sendFileSignal({
                    targetPeerId: input.sourcePeerId,
                    signal: {
                        kind: 'reject',
                        fileId: input.signal.fileId,
                        reason: 'File busy',
                    },
                })
                return
            }

            openTransferSession({
                kind: 'upload',
                room: input.room,
                sessions: input.sessions,
                dispatch: input.dispatch,
                fileId: input.signal.fileId,
                localFile,
                meta: localFile.meta,
                peerId: input.sourcePeerId,
            })

            input.dispatch({
                kind: 'upload-started',
                fileId: input.signal.fileId,
                peerId: input.sourcePeerId,
            })
            return
        }
        case 'signal': {
            const activeSession = input.sessions[input.signal.fileId]
            if (!activeSession) return
            applyFilePeerSignal(
                activeSession.session,
                JSON.parse(input.signal.data) as SignalData,
            )
            return
        }
        case 'cancel':
        case 'complete':
        case 'reject':
            closeTransferSession(
                input.sessions,
                input.dispatch,
                input.signal.fileId,
            )
            return
    }

    return assertNever(input.signal)
}

export function deleteLocalLiveFile(input: {
    room: PadFileRoom | null
    sessions: FileTransferSessions
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
    sessions: FileTransferSessions
    state: FileMachineState
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void
    file: LiveFileState
}) {
    const localFile = input.state.localFiles[input.file.meta.id]
    if (localFile) {
        void saveLocalFile(localFile).catch((error) =>
            toast.error((error as Error).message),
        )
        return
    }

    if (!input.room) return
    if (input.sessions[input.file.meta.id]) return

    const owner = chooseRemoteOwner(input.file.owners, input.room.peerId)
    if (!owner) return

    openTransferSession({
        kind: 'download',
        dispatch: input.dispatch,
        fileId: input.file.meta.id,
        meta: input.file.meta,
        peerId: owner.peerId,
        room: input.room,
        sessions: input.sessions,
    })

    input.dispatch({
        kind: 'download-started',
        fileId: input.file.meta.id,
        peerId: owner.peerId,
    })
    input.room.sendFileSignal({
        targetPeerId: owner.peerId,
        signal: { kind: 'request', fileId: input.file.meta.id },
    })
}

export function createPendingLocalFile(file: File) {
    return createLocalFile(file)
}

export function closeAllTransferSessions(sessions: FileTransferSessions) {
    for (const fileId of Object.keys(sessions)) {
        const activeSession = sessions[fileId]
        if (!activeSession) continue
        delete sessions[fileId]
        closeFilePeer(activeSession.session)
    }
}

export function createEmptyFileTransferState() {
    return createFileMachineState()
}

export async function clearLocalFiles(files: Record<string, LocalFile>) {
    await Promise.all(
        Object.values(files).map((file) => deleteLocalFileData(file)),
    )
}

function openTransferSession(input: OpenTransferSessionInput) {
    const session = openFilePeer({
        initiator: input.kind === 'download',
        fileId: input.fileId,
        peerId: input.peerId,
        meta: input.meta,
        localFile: input.kind === 'upload' ? input.localFile : null,
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
            if (input.kind === 'download') {
                void saveLocalFile(localFile).catch((error) =>
                    toast.error((error as Error).message),
                )
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
            if (input.sessions[input.fileId]?.session !== session) return
            delete input.sessions[input.fileId]
            input.dispatch({ kind: 'transfer-cleared', fileId: input.fileId })
        },
    })

    input.sessions[input.fileId] = {
        kind: input.kind,
        peerId: input.peerId,
        session,
    }
}

function closeTransferSession(
    sessions: FileTransferSessions,
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void,
    fileId: string,
) {
    const activeSession = sessions[fileId]
    if (activeSession) {
        delete sessions[fileId]
        closeFilePeer(activeSession.session)
    }

    dispatch({ kind: 'transfer-cleared', fileId })
}
