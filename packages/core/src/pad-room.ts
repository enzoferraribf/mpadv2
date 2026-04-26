import { assert } from './assert'
import { type PadPath, padPath } from './pad-path'

export type PadDocKind = 'text' | 'drawing'
export type PadRoomKind = PadDocKind | 'files'

export type PadRoom = {
    path: PadPath
    kind: PadRoomKind
}

export function padRoomName(path: PadPath, kind: PadRoomKind): string {
    return `${path}:${kind}`
}

export function parsePadRoomName(value: string): PadRoom {
    const index = value.lastIndexOf(':')
    assert(index > 0, `Invalid room name: ${value}`)
    const path = padPath(value.slice(0, index))
    const kind = value.slice(index + 1)
    assert(
        kind === 'text' || kind === 'drawing' || kind === 'files',
        `Unknown room kind: ${kind}`,
    )
    return { path, kind }
}
