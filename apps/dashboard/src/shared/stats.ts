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

export type PadCountRow = {
    path: string
    count: number
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
        rootPathsCreated: number
        activeDays: number
        averageRevisionBytes: number
        latestRevisionAt: string | null
        fileTransfersTracked: false
    }
    series: MetricPoint[]
    hourlyRevisions: HourPoint[]
    topEditedPads: PadCountRow[]
    busiestRootPaths: PadCountRow[]
}
