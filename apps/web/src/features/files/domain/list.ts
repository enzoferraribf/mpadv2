import type { FileAwarenessState } from '@/shared/realtime/client'
import type {
    LiveFileMeta,
    LiveFileOwner,
    LiveFileState,
} from '@mpad/protocol/live-files'
import type { LocalFileMap, TransferMap } from './state'

export function buildLiveFileList(
    states: Map<number, FileAwarenessState>,
    localFiles: LocalFileMap,
    transfers: TransferMap,
) {
    return Array.from(groupFilesByOwner(states).values(), ({ meta, owners }) =>
        readLiveFileState(meta, owners, localFiles, transfers),
    ).sort((left, right) => left.meta.name.localeCompare(right.meta.name))
}

export function chooseRemoteOwner(
    owners: LiveFileOwner[],
    localPeerId: number,
) {
    return owners.find((owner) => owner.peerId !== localPeerId) ?? null
}

function groupFilesByOwner(states: Map<number, FileAwarenessState>) {
    const grouped = new Map<
        string,
        { meta: LiveFileMeta; owners: LiveFileOwner[] }
    >()

    for (const [peerId, state] of states) {
        for (const meta of state.files) {
            appendFileOwner(grouped, meta, {
                peerId,
                peerName: state.user.name,
            })
        }
    }

    return grouped
}

function appendFileOwner(
    grouped: Map<string, { meta: LiveFileMeta; owners: LiveFileOwner[] }>,
    meta: LiveFileMeta,
    owner: LiveFileOwner,
) {
    const current = grouped.get(meta.id)
    if (current) {
        current.owners.push(owner)
        return
    }
    grouped.set(meta.id, { meta, owners: [owner] })
}

function readLiveFileState(
    meta: LiveFileMeta,
    owners: LiveFileOwner[],
    localFiles: LocalFileMap,
    transfers: TransferMap,
): LiveFileState {
    const transfer = transfers[meta.id]
    const isLocal = localFiles[meta.id] !== undefined
    if (transfer)
        return {
            kind: 'transferring',
            meta,
            owners,
            isLocal,
            transfer,
        }
    return {
        kind: 'available',
        meta,
        owners,
        isLocal,
    }
}
