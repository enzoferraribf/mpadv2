import type { LiveFileMeta } from '@mmpad/shared'
import type { FileAwarenessState, FileAwarenessUser } from '@/pad-session/pad-room-types'

export function createFileAwarenessState(user: FileAwarenessUser, files: LiveFileMeta[]): FileAwarenessState {
    return { user, files }
}

export function readFileAwarenessStates(states: Iterable<[number, unknown]>) {
    const nextStates = new Map<number, FileAwarenessState>()

    for (const [peerId, state] of states) {
        const nextState = readFileAwarenessState(state)
        if (!nextState) continue
        nextStates.set(peerId, nextState)
    }

    return nextStates
}

function readFileAwarenessState(value: unknown): FileAwarenessState | null {
    if (!isRecord(value)) return null

    const user = readFileAwarenessUser(value.user)
    const files = readLiveFileMetaList(value.files)
    if (!user || !files) return null

    return { user, files }
}

function readFileAwarenessUser(value: unknown): FileAwarenessUser | null {
    if (!isRecord(value)) return null
    if (typeof value.name !== 'string') return null

    return { name: value.name }
}

function readLiveFileMetaList(value: unknown): LiveFileMeta[] | null {
    if (!Array.isArray(value)) return null

    const files: LiveFileMeta[] = []

    for (const item of value) {
        const file = readLiveFileMeta(item)
        if (!file) return null
        files.push(file)
    }

    return files
}

function readLiveFileMeta(value: unknown): LiveFileMeta | null {
    if (!isRecord(value)) return null
    if (typeof value.id !== 'string') return null
    if (typeof value.name !== 'string') return null
    if (typeof value.mimeType !== 'string') return null
    if (typeof value.sizeBytes !== 'number') return null
    if (typeof value.createdAt !== 'string') return null

    return {
        id: value.id,
        name: value.name,
        mimeType: value.mimeType,
        sizeBytes: value.sizeBytes,
        createdAt: value.createdAt,
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}
