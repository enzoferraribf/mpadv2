import type { LiveFileState, PadPath, PadTreeItem } from '@mmpad/shared'
import { useMemo } from 'react'
import { usePadFiles } from '@/pad-files/use-pad-files'
import { usePadTree } from '@/pad-tree/use-pad-tree'
import { loadLocalPeer } from '@/pad-session/local-peer'
import type { PadConnection, PadDrawingRoom, PadTextRoom } from '@/pad-session/pad-room-types'
import { usePadDrawingRoom } from '@/pad-session/use-pad-drawing-room'
import { usePadTextRoom } from '@/pad-session/use-pad-text-room'

export type PadPageState =
    | { kind: 'loading' }
    | ReadyPadPageState

export type ReadyPadPageState = {
    kind: 'ready'
    view: {
        brand: 'Mpad'
        path: PadPath
        connection: PadConnection
        peerCount: number
        fileCount: number
    }
    text: {
        content: string
        room: PadTextRoom
    }
    drawing:
        | { kind: 'closed' }
        | { kind: 'ready'; room: PadDrawingRoom }
    tree: PadTreeItem[]
    files: LiveFileState[]
    uploadFile: (file: File) => void
    deleteFile: (id: string) => void
    downloadFile: (file: LiveFileState) => void
}

export function usePadPage(path: PadPath, drawingOpen: boolean): PadPageState {
    const localPeer = useMemo(loadLocalPeer, [])
    const text = usePadTextRoom(path, localPeer)
    const drawingRoom = usePadDrawingRoom(path, localPeer, drawingOpen)
    const tree = usePadTree(path)
    const files = usePadFiles(path, localPeer)

    if (!text || tree === null) return { kind: 'loading' }

    return {
        kind: 'ready',
        view: {
            brand: 'Mpad',
            path,
            connection: text.connection,
            peerCount: text.peerCount,
            fileCount: files.files.length,
        },
        text: {
            content: text.textContent,
            room: text.room,
        },
        drawing: drawingRoom ? { kind: 'ready', room: drawingRoom } : { kind: 'closed' },
        tree,
        files: files.files,
        uploadFile: files.uploadFile,
        deleteFile: files.deleteFile,
        downloadFile: files.downloadFile,
    }
}
