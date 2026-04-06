import { assert } from './assert'

export type PadPath = `/${string}`

export function padPath(value: string): PadPath {
    const normalized = '/' + value.split('/').filter(Boolean).join('/')
    assert(normalized !== '/', 'Pad path is required')
    return normalized as PadPath
}

export function rootPadPath(path: PadPath): PadPath {
    const [root] = path.split('/').filter(Boolean)
    assert(root !== undefined, 'Pad path is required')
    return (`/${root}`) as PadPath
}

export function parentPadPath(path: PadPath): PadPath | null {
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 1) return null
    return (`/${parts.slice(0, -1).join('/')}`) as PadPath
}

export function padPathAncestors(path: PadPath): PadPath[] {
    const parts = path.split('/').filter(Boolean)
    return parts.map((_, index) => (`/${parts.slice(0, index + 1).join('/')}`) as PadPath)
}

export function padPathName(path: PadPath): string {
    return path.split('/').filter(Boolean).at(-1) ?? path
}
