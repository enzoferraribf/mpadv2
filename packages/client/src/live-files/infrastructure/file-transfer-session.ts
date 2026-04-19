import type { PadFileRoom } from '@/collab/domain/pad-room-session'
import type { reduceFileMachine } from '@/live-files/domain/live-files-machine'
import type { LiveFileMeta } from '@mpad/protocol/live-files'
import { toast } from 'sonner'
import { type FilePeerSession, closeFilePeer, openFilePeer } from './file-peer'
import type { LocalFile } from './local-file-store'
import { saveLocalFile } from './local-file-store'

export type FileTransferSession =
    | { kind: 'download'; peerId: number; session: FilePeerSession }
    | { kind: 'upload'; peerId: number; session: FilePeerSession }

export type FileTransferSessions = Record<string, FileTransferSession>

type TransferDispatch = (event: Parameters<typeof reduceFileMachine>[1]) => void

type OpenTransferSessionInput =
    | {
          kind: 'download'
          dispatch: TransferDispatch
          fileId: string
          meta: LiveFileMeta
          peerId: number
          room: PadFileRoom
          sessions: FileTransferSessions
      }
    | {
          kind: 'upload'
          dispatch: TransferDispatch
          fileId: string
          localFile: LocalFile
          meta: LiveFileMeta
          peerId: number
          room: PadFileRoom
          sessions: FileTransferSessions
      }

export function openTransferSession(input: OpenTransferSessionInput) {
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

export function closeTransferSession(
    sessions: FileTransferSessions,
    dispatch: TransferDispatch,
    fileId: string,
) {
    const activeSession = sessions[fileId]
    if (activeSession) {
        delete sessions[fileId]
        closeFilePeer(activeSession.session)
    }

    dispatch({ kind: 'transfer-cleared', fileId })
}

export function closeAllTransferSessions(sessions: FileTransferSessions) {
    for (const fileId of Object.keys(sessions)) {
        const activeSession = sessions[fileId]
        if (!activeSession) continue
        delete sessions[fileId]
        closeFilePeer(activeSession.session)
    }
}
