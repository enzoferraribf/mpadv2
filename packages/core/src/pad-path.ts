import { assert } from './assert'
import {
    MAX_PAD_PATH_BYTES,
    MAX_PAD_PATH_SEGMENTS,
    MAX_PAD_PATH_SEGMENT_BYTES,
} from './pad-limits'

export type PadPath = `/${string}`

export function padPath(value: string): PadPath {
    const normalized = '/' + value.split('/').filter(Boolean).join('/')
    assert(normalized !== '/', 'Pad path is required')
    assert(
        utf8Bytes(normalized) <= MAX_PAD_PATH_BYTES,
        `Pad path exceeds ${MAX_PAD_PATH_BYTES} bytes`,
    )
    assert(!hasControlCharacter(normalized), 'Pad path contains control chars')

    const segments = normalized.split('/').filter(Boolean)
    assert(
        segments.length <= MAX_PAD_PATH_SEGMENTS,
        `Pad path exceeds ${MAX_PAD_PATH_SEGMENTS} segments`,
    )
    for (const segment of segments) {
        assert(segment.trim() === segment, 'Pad path segment has outer spaces')
        assert(
            segment !== '.' && segment !== '..',
            'Pad path segment is unsafe',
        )
        assert(
            utf8Bytes(segment) <= MAX_PAD_PATH_SEGMENT_BYTES,
            `Pad path segment exceeds ${MAX_PAD_PATH_SEGMENT_BYTES} bytes`,
        )
        assert(isAllowedSegment(segment), 'Pad path contains unsafe characters')
    }

    return normalized as PadPath
}

export function rootPadPath(path: PadPath): PadPath {
    const [root] = path.split('/').filter(Boolean)
    assert(root !== undefined, 'Pad path is required')
    return `/${root}` as PadPath
}

export function parentPadPath(path: PadPath): PadPath | null {
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 1) return null
    return `/${parts.slice(0, -1).join('/')}` as PadPath
}

export function padPathAncestors(path: PadPath): PadPath[] {
    const parts = path.split('/').filter(Boolean)
    return parts.map(
        (_, index) => `/${parts.slice(0, index + 1).join('/')}` as PadPath,
    )
}

export function padPathName(path: PadPath): string {
    return path.split('/').filter(Boolean).at(-1) ?? path
}

function isAllowedSegment(value: string) {
    return /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(value)
}

function hasControlCharacter(value: string) {
    for (const character of value) {
        const code = character.charCodeAt(0)
        if (code < 32 || code === 127) return true
    }
    return false
}

function utf8Bytes(value: string) {
    return new TextEncoder().encode(value).byteLength
}
