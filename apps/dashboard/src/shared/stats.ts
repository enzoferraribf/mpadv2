export type DateRange = {
    from: string
    to: string
    timezone: string
}

export type MetricPoint = {
    date: string
    padsCreated: number
    padsEdited: number
    textRevisions: number
    drawingRevisions: number
}

export type DailyActivityRow = MetricPoint & {
    totalActivity: number
    revisionBytes: number
}

export type RevisionPathRow = {
    path: string
    revisions: number
    revisionBytes: number
    latestRevisionAt: string | null
}

export type RootActivityRow = {
    path: string
    revisions: number
    pads: number
}

export type RootPadsRow = {
    path: string
    pads: number
    latestPadCreatedAt: string | null
}

export type PadActivityRow = {
    path: string
    revisions: number
    latestRevisionAt: string | null
}

export type StalePadRow = {
    path: string
    revisions: number
    lastUpdatedAt: string | null
}

export type HourPoint = {
    hour: number
    revisions: number
}

export type DashboardStats = {
    range: DateRange
    generatedAt: string
    totals: {
        padsCreated: number
        padsEdited: number
        textRevisions: number
        drawingRevisions: number
        textDocuments: number
        drawingDocuments: number
        totalRevisionBytes: number
        totalPads: number
        rootPaths: number
        activeRootPaths: number
        rootPathsCreated: number
        existingRootPaths: number
        activeDays: number
        averageRevisionBytes: number
        creationToEditRate: number
        averageEditsPerEditedPad: number
        averagePadsPerRoot: number
        textDocumentRatio: number
        newRootShare: number
        latestRevisionAt: string | null
        fileTransfersTracked: false
    }
    series: MetricPoint[]
    dailyActivity: DailyActivityRow[]
    hourlyRevisions: HourPoint[]
    topEditedPads: RevisionPathRow[]
    busiestRootPaths: RootActivityRow[]
    largestRevisionPaths: RevisionPathRow[]
    topRootsByPads: RootPadsRow[]
    recentlyActivePads: PadActivityRow[]
    stalePads: StalePadRow[]
}
