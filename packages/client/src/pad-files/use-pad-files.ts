import {
    MAX_FILE_BYTES,
    MAX_PEER_FILE_BYTES,
    MAX_PEER_FILE_COUNT,
    assertLiveFileAllowed,
    rootPadPath,
    type LiveFileState,
    type PadPath,
} from '@mmpad/shared'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createFileAwarenessState, readFileAwarenessStates } from '@/pad-session/file-awareness'
import type { FileAwarenessUser, LocalPeer, PadFileRoom } from '@/pad-session/pad-room-types'
import { usePadRoomSession } from '@/pad-session/use-pad-room-session'
import {
    buildLiveFileList,
    createFileMachineState,
    reduceFileMachine,
    totalLocalFileBytes,
} from './file-machine'
import type { LocalFile } from './local-file'
import type { FilePeerSession } from './file-peer'
import {
    clearLocalFiles,
    closeAllTransferSessions,
    createPendingLocalFile,
    deleteLocalLiveFile,
    downloadLiveFile,
    handleIncomingFileSignal,
} from './file-transfer-controller'

export function usePadFiles(path: PadPath, localPeer: LocalPeer) {
    const [state, dispatch] = useReducer(reduceFileMachine, undefined, createFileMachineState)
    const roomPath = rootPadPath(path)
    const [stateScopePath, setStateScopePath] = useState(roomPath)
    const [awarenessVersion, setAwarenessVersion] = useState(0)
    const scopedState = useMemo(
        () => stateScopePath === roomPath ? state : createFileMachineState(),
        [roomPath, state, stateScopePath],
    )
    const stateRef = useRef(scopedState)
    const sessionsRef = useRef<Record<string, FilePeerSession>>({})
    const awarenessUser = useMemo<FileAwarenessUser>(() => ({ name: localPeer.name }), [localPeer.name])
    const localState = useMemo(
        () => createFileAwarenessState(awarenessUser, Object.values(scopedState.localFiles).map((file) => file.meta)),
        [awarenessUser, scopedState.localFiles],
    )
    const session = usePadRoomSession({
        path: roomPath,
        kind: 'files',
        localState,
    })
    const room = useMemo<PadFileRoom | null>(() => {
        if (!session) return null

        return {
            ...session,
            setLocalFiles(files) {
                session.setLocalState(createFileAwarenessState(awarenessUser, files))
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
        stateRef.current = scopedState
    }, [scopedState])

    useEffect(() => {
        if (stateScopePath === roomPath) return
        closeAllTransferSessions(sessionsRef.current)
        void clearLocalFiles(stateRef.current.localFiles)
        dispatch({ kind: 'reset' })
        setStateScopePath(roomPath)
    }, [roomPath, stateScopePath])

    useEffect(() => {
        if (!room) return
        const onAwareness = () => setAwarenessVersion((value) => value + 1)
        room.awareness.on('change', onAwareness)
        onAwareness()
        return () => room.awareness.off('change', onAwareness)
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

    useEffect(() => () => {
        closeAllTransferSessions(sessionsRef.current)
        void clearLocalFiles(stateRef.current.localFiles)
    }, [])

    const files = useMemo(() => {
        if (!room) return []
        const awarenessStates = readFileAwarenessStates(room.awareness.getStates())
        return buildLiveFileList(awarenessStates, scopedState.localFiles, scopedState.transfers)
    }, [awarenessVersion, room, scopedState.localFiles, scopedState.transfers])

    function uploadFile(file: File) {
        assertFileAllowed(stateRef.current.localFiles, file.size)
        dispatch({ kind: 'local-file-added', localFile: createPendingLocalFile(file) })
    }

    function deleteFile(fileId: string) {
        deleteLocalLiveFile({
            room,
            sessions: sessionsRef.current,
            state: stateRef.current,
            dispatch,
            fileId,
        })
    }

    function downloadFile(file: LiveFileState) {
        assertFileAllowed(stateRef.current.localFiles, file.meta.sizeBytes)
        downloadLiveFile({
            room,
            sessions: sessionsRef.current,
            state: stateRef.current,
            dispatch,
            file,
        })
    }

    return {
        files,
        deleteFile,
        downloadFile,
        uploadFile,
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
