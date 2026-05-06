import type {
    DailyActivityRow,
    DashboardStats,
    HourPoint,
} from '@/shared/stats'

export type PeakDay = {
    date: string
    count: number
}

export type PeakStorageDay = {
    date: string
    bytes: number
}

export function readDashboardHighlights(stats: DashboardStats | null) {
    return {
        bytesPerActiveDay:
            stats && stats.totals.activeDays > 0
                ? stats.totals.totalRevisionBytes / stats.totals.activeDays
                : 0,
        peakDay: readPeakDay(stats?.dailyActivity ?? []),
        peakHour: readPeakHour(stats?.hourlyRevisions ?? []),
        peakStorageDay: readPeakStorageDay(stats?.dailyActivity ?? []),
    }
}

function readPeakDay(series: DailyActivityRow[]): PeakDay | null {
    let best: PeakDay | null = null
    for (const point of series) {
        if (!best || point.totalActivity > best.count)
            best = { date: point.date, count: point.totalActivity }
    }
    return best && best.count > 0 ? best : null
}

function readPeakHour(series: HourPoint[]) {
    let best: HourPoint | null = null
    for (const point of series) {
        if (!best || point.revisions > best.revisions) best = point
    }
    return best && best.revisions > 0 ? best : null
}

function readPeakStorageDay(series: DailyActivityRow[]): PeakStorageDay | null {
    let best: PeakStorageDay | null = null
    for (const point of series) {
        if (!best || point.revisionBytes > best.bytes)
            best = { date: point.date, bytes: point.revisionBytes }
    }
    return best && best.bytes > 0 ? best : null
}
