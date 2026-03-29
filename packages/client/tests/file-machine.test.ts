import { describe, expect, test } from 'bun:test'
import { createFileMachineState, reduceFileMachine } from '../src/pad-files/file-machine'

describe('file machine', () => {
    test('stores a completed download and clears its transfer', () => {
        const file = createLocalFile('file-1', 'readme.txt')
        const downloading = reduceFileMachine(createFileMachineState(), {
            kind: 'download-started',
            fileId: file.meta.id,
            peerId: 7,
        })

        const complete = reduceFileMachine(downloading, {
            kind: 'download-completed',
            localFile: file,
        })

        expect(complete.localFiles[file.meta.id]?.meta.name).toBe('readme.txt')
        expect(complete.transfers[file.meta.id]).toBeUndefined()
    })

    test('clears an upload transfer without touching local files', () => {
        const file = createLocalFile('file-2', 'draft.txt')
        const withFile = reduceFileMachine(createFileMachineState(), {
            kind: 'local-file-added',
            localFile: file,
        })
        const uploading = reduceFileMachine(withFile, {
            kind: 'upload-started',
            fileId: file.meta.id,
            peerId: 3,
        })

        const cleared = reduceFileMachine(uploading, {
            kind: 'transfer-cleared',
            fileId: file.meta.id,
        })

        expect(cleared.localFiles[file.meta.id]?.meta.name).toBe('draft.txt')
        expect(cleared.transfers[file.meta.id]).toBeUndefined()
    })
})

function createLocalFile(id: string, name: string) {
    return {
        meta: {
            id,
            name,
            mimeType: 'text/plain',
            sizeBytes: 5,
            createdAt: '2026-03-29T00:00:00.000Z',
        },
        source: {
            kind: 'memory' as const,
            file: new File(['hello'], name, { type: 'text/plain' }),
        },
    }
}
