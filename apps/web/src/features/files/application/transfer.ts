import { chooseRemoteOwner } from '@/features/files/domain/list'
import {
    type FileMachineState,
    createFileMachineState,
    type reduceFileMachine,
} from '@/features/files/domain/state'
import type { PadFileRoom } from '@/shared/realtime/client'
import { assertNever } from '@mpad/core/assert'
import type { FileSignal, LiveFileState } from '@mpad/protocol/live-files'
import type { SignalData } from 'simple-peer'
import { toast } from 'sonner'
import { applyFilePeerSignal } from './peer'
import {
    type FileTransferSessions,
    closeTransferSession,
    openTransferSession,
} from './session'
import {
    type LocalFile,
    createLocalFile,
    deleteLocalFileData,
    saveLocalFile,
} from './store'
export type {
    FileTransferSession,
    FileTransferSessions,
} from './session'
export { closeAllTransferSessions } from './session'

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
        void saveLocalFile(localFile).catch((error) => {
            input.dispatch({
                kind: 'local-file-removed',
                fileId: input.file.meta.id,
            })
            void deleteLocalFileData(localFile)
            downloadRemoteLiveFile(input)
            if (
                !input.room ||
                !chooseRemoteOwner(input.file.owners, input.room.peerId)
            ) {
                toast.error((error as Error).message)
            }
        })
        return
    }

    downloadRemoteLiveFile(input)
}

function downloadRemoteLiveFile(input: {
    room: PadFileRoom | null
    sessions: FileTransferSessions
    state: FileMachineState
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void
    file: LiveFileState
}) {
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

export function createEmptyFileTransferState() {
    return createFileMachineState()
}

export async function clearLocalFiles(files: Record<string, LocalFile>) {
    await Promise.all(
        Object.values(files).map((file) => deleteLocalFileData(file)),
    )
}
