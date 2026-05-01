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

export type HistogramBin = {
    label: string
    count: number
}

export type PadCountRow = {
    path: string
    count: number
}

export type PadSizeRow = {
    path: string
    characters: number
}

export type DashboardStats = {
    range: DateRange
    generatedAt: string
    totals: {
        padsCreated: number
        padsEdited: number
        textRevisions: number
        drawingRevisions: number
        drawings: number
        drawingElements: number
        totalRevisionBytes: number
        fileTransfersTracked: false
    }
    series: MetricPoint[]
    textSizeDistribution: HistogramBin[]
    drawingElementDistribution: HistogramBin[]
    topEditedPads: PadCountRow[]
    largestTextPads: PadSizeRow[]
    busiestRootPaths: PadCountRow[]
    warnings: {
        unreadableDocuments: number
    }
}
