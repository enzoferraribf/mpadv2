import {
    type LiveFileMeta,
    liveFileMetaSchema,
} from '@mpad/protocol/live-files'

const FILE_STORE_DIR = 'mpad-live-files'
const MEMORY_DOWNLOAD_LIMIT_BYTES = 50 * 1024 * 1024

export type LocalFile = {
    meta: LiveFileMeta
    source: LocalFileSource
}

export type LocalFileSource =
    | { kind: 'memory'; file: File }
    | { kind: 'stored' }

export type DownloadTarget = {
    write: (chunk: Uint8Array) => Promise<void>
    complete: () => Promise<LocalFile>
    abort: () => Promise<void>
}

type StorageManagerWithDirectory = StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>
}

export function createLocalFile(file: File): LocalFile {
    const meta = liveFileMetaSchema.parse({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
    })

    return {
        meta,
        source: { kind: 'memory', file },
    }
}

export async function createDownloadTarget(
    meta: LiveFileMeta,
): Promise<DownloadTarget> {
    const root = await getFileStoreRoot()
    if (root) return createStoredDownloadTarget(root, meta)

    if (meta.sizeBytes > MEMORY_DOWNLOAD_LIMIT_BYTES) {
        throw new Error(
            'Large file downloads need browser file storage support',
        )
    }

    return createMemoryDownloadTarget(meta)
}

export async function deleteLocalFileData(localFile: LocalFile) {
    if (localFile.source.kind !== 'stored') return

    const root = await getFileStoreRoot()
    if (!root) return

    try {
        await root.removeEntry(localFile.meta.id)
    } catch {
        return
    }
}

export async function saveLocalFile(localFile: LocalFile) {
    const blob = await getLocalBlob(localFile)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = localFile.meta.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function* readLocalFileChunks(
    localFile: LocalFile,
    chunkBytes: number,
): AsyncGenerator<Uint8Array> {
    const blob = await getLocalBlob(localFile)

    for (let offset = 0; offset < blob.size; offset += chunkBytes) {
        const chunk = blob.slice(offset, offset + chunkBytes)
        yield new Uint8Array(await chunk.arrayBuffer())
    }
}

async function getLocalBlob(localFile: LocalFile): Promise<Blob> {
    if (localFile.source.kind === 'memory') return localFile.source.file

    const root = await getFileStoreRoot()
    if (!root) throw new Error('Browser file storage unavailable')

    const handle = await root.getFileHandle(localFile.meta.id)
    return handle.getFile()
}

function createMemoryDownloadTarget(meta: LiveFileMeta): DownloadTarget {
    const parts: Uint8Array[] = []

    return {
        async write(chunk) {
            parts.push(chunk)
        },
        async complete() {
            return {
                meta,
                source: {
                    kind: 'memory',
                    file: new File(parts.map(toArrayBuffer), meta.name, {
                        type: meta.mimeType,
                        lastModified: new Date(meta.createdAt).getTime(),
                    }),
                },
            }
        },
        async abort() {
            parts.length = 0
        },
    }
}

async function createStoredDownloadTarget(
    root: FileSystemDirectoryHandle,
    meta: LiveFileMeta,
): Promise<DownloadTarget> {
    const handle = await root.getFileHandle(meta.id, { create: true })
    const writable = await handle.createWritable()
    let closed = false

    return {
        async write(chunk) {
            if (closed) throw new Error('File writer already closed')
            const bytes = new Uint8Array(chunk.byteLength)
            bytes.set(chunk)
            await writable.write(new Blob([bytes.buffer]))
        },
        async complete() {
            if (!closed) {
                closed = true
                await writable.close()
            }

            return {
                meta,
                source: { kind: 'stored' },
            }
        },
        async abort() {
            if (!closed) {
                closed = true
                try {
                    await writable.abort()
                } catch {
                    // Ignore and still try to clean up the temp file.
                }
            }

            try {
                await root.removeEntry(meta.id)
            } catch {
                return
            }
        },
    }
}

async function getFileStoreRoot() {
    if (typeof navigator === 'undefined') return null

    const storage = navigator.storage as StorageManagerWithDirectory
    if (typeof storage.getDirectory !== 'function') return null

    const root = await storage.getDirectory()
    return root.getDirectoryHandle(FILE_STORE_DIR, { create: true })
}

function toArrayBuffer(value: Uint8Array) {
    return new Uint8Array(value).buffer
}
