import {
    MAX_FILE_ID_BYTES,
    MAX_FILE_MIME_BYTES,
    MAX_FILE_NAME_BYTES,
    MAX_FILE_REJECT_REASON_BYTES,
    MAX_FILE_SIGNAL_BYTES,
    MAX_PEER_NAME_BYTES,
} from '@mpad/core/pad-limits'
import { z } from 'zod'

const cappedString = (maxBytes: number) =>
    z
        .string()
        .min(1)
        .refine((value) => utf8Bytes(value) <= maxBytes, {
            message: `String exceeds ${maxBytes} bytes`,
        })

export const liveFileMetaSchema = z.object({
    id: cappedString(MAX_FILE_ID_BYTES),
    name: cappedString(MAX_FILE_NAME_BYTES),
    mimeType: cappedString(MAX_FILE_MIME_BYTES),
    sizeBytes: z.number().int().nonnegative(),
    createdAt: z.string().min(1),
})

export const liveFileOwnerSchema = z.object({
    peerId: z.number().int().nonnegative(),
    peerName: cappedString(MAX_PEER_NAME_BYTES),
})

export const fileSignalSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('request'),
        fileId: cappedString(MAX_FILE_ID_BYTES),
    }),
    z.object({
        kind: z.literal('signal'),
        fileId: cappedString(MAX_FILE_ID_BYTES),
        data: cappedString(MAX_FILE_SIGNAL_BYTES),
    }),
    z.object({
        kind: z.literal('cancel'),
        fileId: cappedString(MAX_FILE_ID_BYTES),
    }),
    z.object({
        kind: z.literal('complete'),
        fileId: cappedString(MAX_FILE_ID_BYTES),
    }),
    z.object({
        kind: z.literal('reject'),
        fileId: cappedString(MAX_FILE_ID_BYTES),
        reason: cappedString(MAX_FILE_REJECT_REASON_BYTES),
    }),
])

export const outboundFileSignalSchema = z.object({
    targetPeerId: z.number().int().nonnegative(),
    signal: fileSignalSchema,
})

export type LiveFileMeta = z.infer<typeof liveFileMetaSchema>

export type LiveFileOwner = z.infer<typeof liveFileOwnerSchema>

export type LiveFileTransfer =
    | {
          kind: 'uploading'
          peerId: number
          sentBytes: number
      }
    | {
          kind: 'downloading'
          peerId: number
          receivedBytes: number
      }

export type LiveFileState =
    | {
          kind: 'available'
          meta: LiveFileMeta
          owners: LiveFileOwner[]
          isLocal: boolean
      }
    | {
          kind: 'transferring'
          meta: LiveFileMeta
          owners: LiveFileOwner[]
          isLocal: boolean
          transfer: LiveFileTransfer
      }

export type FileSignal = z.infer<typeof fileSignalSchema>

export type OutboundFileSignal = z.infer<typeof outboundFileSignalSchema>

export type InboundFileSignal = {
    sourcePeerId: number
    signal: FileSignal
}

export function assertLiveFileAllowed(input: {
    fileSize: number
    fileCount: number
    totalBytes: number
    maxFileBytes: number
    maxFileCount: number
    maxTotalBytes: number
}) {
    if (input.fileSize > input.maxFileBytes)
        throw new Error(`File exceeds ${input.maxFileBytes / (1024 * 1024)}MB`)
    if (input.fileCount >= input.maxFileCount)
        throw new Error('Peer file count limit reached')
    if (input.totalBytes + input.fileSize > input.maxTotalBytes)
        throw new Error('Peer file size limit reached')
}

function utf8Bytes(value: string) {
    return new TextEncoder().encode(value).byteLength
}
