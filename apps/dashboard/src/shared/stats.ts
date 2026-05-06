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
}
