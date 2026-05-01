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
        fileTransfersTracked: false
    }
    series: MetricPoint[]
    topEditedPads: PadCountRow[]
    busiestRootPaths: PadCountRow[]
}
