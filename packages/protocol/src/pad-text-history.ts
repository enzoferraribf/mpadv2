export type PadDocRevisionSummary = {
    id: number
    revisionNumber: number
    createdAt: string
    isHead: boolean
    revertedFromRevisionNumber: number | null
}

export type PadTextRevision = {
    id: number
    revisionNumber: number
    createdAt: string
    content: string
}
