import { describe, expect, test } from 'bun:test'
import { MAX_FILE_BYTES, MAX_PEER_FILE_BYTES, MAX_PEER_FILE_COUNT } from '@mpad/core/pad-limits'
import { assertLiveFileAllowed } from '@mpad/protocol/live-files'

describe('live file policy', () => {
    test('accepts a valid file', () => {
        expect(() =>
            assertLiveFileAllowed({
                fileSize: MAX_FILE_BYTES,
                fileCount: 0,
                totalBytes: 0,
                maxFileBytes: MAX_FILE_BYTES,
                maxFileCount: MAX_PEER_FILE_COUNT,
                maxTotalBytes: MAX_PEER_FILE_BYTES,
            }),
        ).not.toThrow()
    })

    test('rejects files that are too large', () => {
        expect(() =>
            assertLiveFileAllowed({
                fileSize: MAX_FILE_BYTES + 1,
                fileCount: 0,
                totalBytes: 0,
                maxFileBytes: MAX_FILE_BYTES,
                maxFileCount: MAX_PEER_FILE_COUNT,
                maxTotalBytes: MAX_PEER_FILE_BYTES,
            }),
        ).toThrow(`File exceeds ${MAX_FILE_BYTES / (1024 * 1024)}MB`)
    })

    test('rejects peers that reached the file count limit', () => {
        expect(() =>
            assertLiveFileAllowed({
                fileSize: 1,
                fileCount: MAX_PEER_FILE_COUNT,
                totalBytes: 0,
                maxFileBytes: MAX_FILE_BYTES,
                maxFileCount: MAX_PEER_FILE_COUNT,
                maxTotalBytes: MAX_PEER_FILE_BYTES,
            }),
        ).toThrow('Peer file count limit reached')
    })

    test('rejects peers that reached the file byte limit', () => {
        expect(() =>
            assertLiveFileAllowed({
                fileSize: 1,
                fileCount: 0,
                totalBytes: MAX_PEER_FILE_BYTES,
                maxFileBytes: MAX_FILE_BYTES,
                maxFileCount: MAX_PEER_FILE_COUNT,
                maxTotalBytes: MAX_PEER_FILE_BYTES,
            }),
        ).toThrow('Peer file size limit reached')
    })
})
