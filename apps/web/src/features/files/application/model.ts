import type { LocalFile } from '@/features/files/application/store'
import {
    type FileTransferSessions,
    clearLocalFiles,
    closeAllTransferSessions,
    createPendingLocalFile,
    deleteLocalLiveFile,
    downloadLiveFile,
    handleIncomingFileSignal,
} from '@/features/files/application/transfer'
import {
    createFileAwarenessState,
    readFileAwarenessStates,
} from '@/features/files/domain/awareness'
import { buildLiveFileList } from '@/features/files/domain/list'
import {
    createFileMachineState,
    reduceFileMachine,
    totalLocalFileBytes,
} from '@/features/files/domain/state'
import type { FileAwarenessUser, PadFileRoom } from '@/shared/realtime/client'
import { useBrowserRoomSession } from '@/shared/realtime/client'
import {
    MAX_FILE_BYTES,
    MAX_PEER_FILE_BYTES,
    MAX_PEER_FILE_COUNT,
} from '@mpad/core/pad-limits'
import type { PadPath } from '@mpad/core/pad-path'
import {
    type LiveFileState,
    assertLiveFileAllowed,
} from '@mpad/protocol/live-files'
import type { PadConnection } from '@mpad/protocol/pad-connection'
import type { LocalPeer } from '@mpad/protocol/peer'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'

export type LiveFilesModel = {
    connection: PadConnection
    files: LiveFileState[]
    deleteFile: (id: string) => void
    downloadFile: (file: LiveFileState) => void
    uploadFile: (file: File) => void
}

export function useLiveFiles(
    path: PadPath,
    localPeer: LocalPeer,
    open: boolean,
): LiveFilesModel {
    const [state, dispatch] = useReducer(
        reduceFileMachine,
        undefined,
        createFileMachineState,
    )
    const [awarenessVersion, setAwarenessVersion] = useState(0)
    const stateRef = useRef(state)
    const sessionsRef = useRef<FileTransferSessions>({})
    const awarenessUser = useMemo<FileAwarenessUser>(
        () => ({ name: localPeer.name }),
        [localPeer.name],
    )
    const localState = useMemo(
        () =>
            createFileAwarenessState(
                awarenessUser,
                Object.values(state.localFiles).map((file) => file.meta),
            ),
        [awarenessUser, state.localFiles],
    )
    const session = useBrowserRoomSession({
        path,
        kind: 'files',
        localState,
        open:
            open ||
            Object.keys(state.localFiles).length > 0 ||
            Object.keys(state.transfers).length > 0,
    })
    const room = useMemo<PadFileRoom | null>(() => {
        if (!session) return null

        return {
            ...session,
            setLocalFiles(files) {
                session.setLocalState(
                    createFileAwarenessState(awarenessUser, files),
                )
            },
            sendFileSignal(signal) {
                session.send({ kind: 'file-signal', signal })
            },
            onFileSignal(listener) {
                return session.onMessage((message) => {
                    if (message.kind !== 'file-signal') return
                    listener(message.signal)
                })
            },
        }
    }, [awarenessUser, session])

    useEffect(() => {
        stateRef.current = state
    }, [state])

    useEffect(() => {
        if (!room) return

        const syncAwareness = () => setAwarenessVersion((value) => value + 1)
        room.awareness.on('change', syncAwareness)
        syncAwareness()

        return () => room.awareness.off('change', syncAwareness)
    }, [room])

    useEffect(() => {
        if (!room) return

        return room.onFileSignal((message) => {
            handleIncomingFileSignal({
                room,
                sessions: sessionsRef.current,
                state: stateRef.current,
                dispatch,
                sourcePeerId: message.sourcePeerId,
                signal: message.signal,
            })
        })
    }, [room])

    useEffect(
        () => () => {
            closeAllTransferSessions(sessionsRef.current)
            void clearLocalFiles(stateRef.current.localFiles)
        },
        [],
    )

    const files = useMemo(() => {
        const awarenessStates = room
            ? readFileAwarenessStates(room.awareness.getStates())
            : new Map()
        return buildLiveFileList(
            awarenessStates,
            state.localFiles,
            state.transfers,
        )
    }, [awarenessVersion, room, state.localFiles, state.transfers])

    return {
        connection: session?.status ?? 'disconnected',
        files,
        deleteFile(fileId) {
            deleteLocalLiveFile({
                room,
                sessions: sessionsRef.current,
                state: stateRef.current,
                dispatch,
                fileId,
            })
        },
        downloadFile(file) {
            assertFileAllowed(stateRef.current.localFiles, file.meta.sizeBytes)
            downloadLiveFile({
                room,
                sessions: sessionsRef.current,
                state: stateRef.current,
                dispatch,
                file,
            })
        },
        uploadFile(file) {
            assertFileAllowed(stateRef.current.localFiles, file.size)
            dispatch({
                kind: 'local-file-added',
                localFile: createPendingLocalFile(file),
            })
        },
    }
}

function assertFileAllowed(files: Record<string, LocalFile>, fileSize: number) {
    assertLiveFileAllowed({
        fileSize,
        fileCount: Object.keys(files).length,
        totalBytes: totalLocalFileBytes(files),
        maxFileBytes: MAX_FILE_BYTES,
        maxFileCount: MAX_PEER_FILE_COUNT,
        maxTotalBytes: MAX_PEER_FILE_BYTES,
    })
}
