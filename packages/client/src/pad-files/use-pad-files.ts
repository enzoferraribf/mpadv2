import {
    MAX_FILE_BYTES,
    MAX_PEER_FILE_BYTES,
    MAX_PEER_FILE_COUNT,
    assertLiveFileAllowed,
    rootPadPath,
    type FileSignal,
    type LiveFileMeta,
    type LiveFileState,
    type PadPath,
} from '@mmpad/shared'
import type { SignalData } from 'simple-peer'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createFileAwarenessState, readFileAwarenessStates } from '@/pad-session/file-awareness'
import type { FileAwarenessUser, LocalPeer, PadFileRoom } from '@/pad-session/pad-room-types'
import { usePadRoomSession } from '@/pad-session/use-pad-room-session'
import {
    buildLiveFileList,
    chooseRemoteOwner,
    createFileMachineState,
    reduceFileMachine,
    totalLocalFileBytes,
} from './file-machine'
import { createLocalFile, deleteLocalFileData, saveLocalFile, type LocalFile } from './local-file'
import { applyFilePeerSignal, closeFilePeer, openFilePeer, type FilePeerSession } from './file-peer'

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
        closeAllSessions(sessionsRef.current)
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
            handleSignal(room, sessionsRef, stateRef, dispatch, message.sourcePeerId, message.signal)
        })
    }, [room])

    useEffect(() => () => {
        closeAllSessions(sessionsRef.current)
        void clearLocalFiles(stateRef.current.localFiles)
    }, [])

    const files = useMemo(() => {
        if (!room) return []
        const awarenessStates = readFileAwarenessStates(room.awareness.getStates())
        return buildLiveFileList(awarenessStates, scopedState.localFiles, scopedState.transfers)
    }, [awarenessVersion, room, scopedState.localFiles, scopedState.transfers])

    function uploadFile(file: File) {
        assertFileAllowed(stateRef.current.localFiles, file.size)
        dispatch({ kind: 'local-file-added', localFile: createLocalFile(file) })
    }

    function deleteFile(fileId: string) {
        const session = sessionsRef.current[fileId]
        const localFile = stateRef.current.localFiles[fileId]
        if (room && session) {
            room.sendFileSignal({
                targetPeerId: session.peerId,
                signal: { kind: 'cancel', fileId },
            })
        }

        closeSession(sessionsRef.current, dispatch, fileId)
        dispatch({ kind: 'local-file-removed', fileId })
        if (localFile) void deleteLocalFileData(localFile)
    }

    function downloadFile(file: LiveFileState) {
        const local = stateRef.current.localFiles[file.meta.id]
        if (local) {
            void saveLocalFile(local).catch((error) => toast.error((error as Error).message))
            return
        }

        if (!room) return
        if (sessionsRef.current[file.meta.id]) return

        assertFileAllowed(stateRef.current.localFiles, file.meta.sizeBytes)

        const owner = chooseRemoteOwner(file.owners, room.peerId)
        if (!owner) return

        openSession({
            room,
            fileId: file.meta.id,
            peerId: owner.peerId,
            initiator: true,
            localFile: null,
            saveOnComplete: true,
            meta: file.meta,
            sessionsRef,
            dispatch,
        })

        dispatch({ kind: 'download-started', fileId: file.meta.id, peerId: owner.peerId })
        room.sendFileSignal({
            targetPeerId: owner.peerId,
            signal: { kind: 'request', fileId: file.meta.id },
        })
    }

    return {
        files,
        deleteFile,
        downloadFile,
        uploadFile,
    }
}

function handleSignal(
    room: PadFileRoom,
    sessionsRef: { current: Record<string, FilePeerSession> },
    stateRef: { current: ReturnType<typeof createFileMachineState> },
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void,
    sourcePeerId: number,
    signal: FileSignal,
) {
    if (signal.kind === 'request') {
        const local = stateRef.current.localFiles[signal.fileId]
        if (!local) {
            room.sendFileSignal({
                targetPeerId: sourcePeerId,
                signal: { kind: 'reject', fileId: signal.fileId, reason: 'File unavailable' },
            })
            return
        }

        if (sessionsRef.current[signal.fileId]) {
            room.sendFileSignal({
                targetPeerId: sourcePeerId,
                signal: { kind: 'reject', fileId: signal.fileId, reason: 'File busy' },
            })
            return
        }

        openSession({
            room,
            fileId: signal.fileId,
            peerId: sourcePeerId,
            initiator: false,
            localFile: local,
            meta: local.meta,
            sessionsRef,
            dispatch,
        })

        dispatch({ kind: 'upload-started', fileId: signal.fileId, peerId: sourcePeerId })
        return
    }

    if (signal.kind === 'signal') {
        const session = sessionsRef.current[signal.fileId]
        if (!session) return
        applyFilePeerSignal(session, JSON.parse(signal.data) as SignalData)
        return
    }

    if (signal.kind === 'cancel' || signal.kind === 'reject' || signal.kind === 'complete') {
        closeSession(sessionsRef.current, dispatch, signal.fileId)
        return
    }

    throw new Error(`Unknown file signal: ${JSON.stringify(signal)}`)
}

function openSession(input: {
    room: PadFileRoom
    fileId: string
    peerId: number
    initiator: boolean
    localFile: LocalFile | null
    saveOnComplete?: boolean
    meta: LiveFileMeta
    sessionsRef: { current: Record<string, FilePeerSession> }
    dispatch: (event: Parameters<typeof reduceFileMachine>[1]) => void
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
        onDownloadComplete(file) {
            input.dispatch({
                kind: 'download-completed',
                localFile: file,
            })
            if (input.saveOnComplete) {
                void saveLocalFile(file).catch((error) => toast.error((error as Error).message))
            }
            closeSession(input.sessionsRef.current, input.dispatch, input.fileId)
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
            if (input.sessionsRef.current[input.fileId] !== session) return
            delete input.sessionsRef.current[input.fileId]
            input.dispatch({ kind: 'transfer-cleared', fileId: input.fileId })
        },
    })

    input.sessionsRef.current[input.fileId] = session
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

function closeAllSessions(sessions: Record<string, FilePeerSession>) {
    for (const fileId of Object.keys(sessions)) {
        const session = sessions[fileId]
        if (!session) continue
        delete sessions[fileId]
        closeFilePeer(session)
    }
}

function closeSession(
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

async function clearLocalFiles(files: Record<string, LocalFile>) {
    await Promise.all(Object.values(files).map((file) => deleteLocalFileData(file)))
}
