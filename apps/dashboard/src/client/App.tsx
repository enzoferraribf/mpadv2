import {
    Activity,
    Brush,
    Clock3,
    Database,
    FileQuestion,
    FileText,
    FolderTree,
    Gauge,
    HardDrive,
    RefreshCw,
    SquarePen,
    Timer,
    TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
    ActivityChart,
    ChartCard,
    DocumentMixChart,
    HourlyChart,
    RevisionBars,
    StorageChart,
    chartColors,
} from './charts'
import { DailyActivityTable } from './daily-activity-table'
import { readDashboardHighlights } from './derived'
import { Kpi, MetricGroup, formatStat } from './kpi'
import {
    addDays,
    formatBytes,
    formatDateTime,
    formatDecimal,
    formatNumber,
    formatPercent,
    isoDate,
} from './lib'
import { useDashboardStats } from './stats-client'
import { Button, Card, Input } from './ui'

type RangePreset = '7d' | '30d' | '90d'

const today = isoDate(new Date())

export function App() {
    const [from, setFrom] = useState(isoDate(addDays(new Date(), -29)))
    const [to, setTo] = useState(today)
    const { error, refresh, stats, status } = useDashboardStats(from, to)
    const highlights = useMemo(() => readDashboardHighlights(stats), [stats])

    return (
        <main className='min-h-svh'>
            <div className='mx-auto flex max-w-[1500px] flex-col gap-6 px-5 py-5'>
                <header className='flex flex-wrap items-end justify-between gap-4 border-border border-b pb-5'>
                    <div className='flex items-center gap-4'>
                        <img
                            alt='MPAD'
                            className='h-12 w-auto rounded-md border border-border'
                            src='/logo.svg'
                        />
                        <div>
                            <h1 className='font-semibold text-2xl tracking-normal'>
                                Dashboard
                            </h1>
                            <p className='text-muted-foreground text-sm'>
                                {stats
                                    ? `${stats.range.from} to ${stats.range.to} (${stats.range.timezone})`
                                    : 'Loading stats'}
                            </p>
                        </div>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <PresetButton preset='7d' setRange={setPresetRange} />
                        <PresetButton preset='30d' setRange={setPresetRange} />
                        <PresetButton preset='90d' setRange={setPresetRange} />
                        <Input
                            aria-label='From'
                            type='date'
                            value={from}
                            onChange={(event) => setFrom(event.target.value)}
                        />
                        <Input
                            aria-label='To'
                            type='date'
                            value={to}
                            onChange={(event) => setTo(event.target.value)}
                        />
                        <Button onClick={refresh}>
                            <RefreshCw className='h-4 w-4' />
                            Refresh
                        </Button>
                    </div>
                </header>

                {status === 'error' ? (
                    <Card className='border-red-400/50 bg-red-950/35 p-4 text-red-100 text-sm'>
                        {error}
                    </Card>
                ) : null}

                <MetricGroup title='Activity'>
                    <Kpi
                        detail={`${formatNumber(stats?.totals.totalPads ?? 0)} total pads`}
                        icon={<SquarePen className='h-4 w-4' />}
                        label='Pads created'
                        value={formatStat(stats?.totals.padsCreated)}
                    />
                    <Kpi
                        detail={`${formatDecimal(stats?.totals.averageEditsPerEditedPad ?? 0)} edits / pad`}
                        icon={<Activity className='h-4 w-4' />}
                        label='Pads edited'
                        value={formatStat(stats?.totals.padsEdited)}
                    />
                    <Kpi
                        detail='Edited pads / created pads'
                        icon={<TrendingUp className='h-4 w-4' />}
                        label='Create to edit'
                        value={
                            stats
                                ? formatPercent(stats.totals.creationToEditRate)
                                : '...'
                        }
                    />
                    <Kpi
                        detail='Text document revisions'
                        icon={<FileText className='h-4 w-4' />}
                        label='Text revisions'
                        value={formatStat(stats?.totals.textRevisions)}
                    />
                    <Kpi
                        detail='Drawing document revisions'
                        icon={<Brush className='h-4 w-4' />}
                        label='Drawing revisions'
                        value={formatStat(stats?.totals.drawingRevisions)}
                    />
                    <Kpi
                        detail={`${formatNumber(stats?.dailyActivity.length ?? 0)} days selected`}
                        icon={<Timer className='h-4 w-4' />}
                        label='Active days'
                        value={formatStat(stats?.totals.activeDays)}
                    />
                </MetricGroup>

                <MetricGroup title='Documents'>
                    <Kpi
                        detail='Head revision exists'
                        icon={<FileText className='h-4 w-4' />}
                        label='Text docs'
                        value={formatStat(stats?.totals.textDocuments)}
                    />
                    <Kpi
                        detail='Head revision exists'
                        icon={<Brush className='h-4 w-4' />}
                        label='Drawing docs'
                        value={formatStat(stats?.totals.drawingDocuments)}
                    />
                    <Kpi
                        detail='Text docs / all docs'
                        icon={<Gauge className='h-4 w-4' />}
                        label='Text share'
                        value={
                            stats
                                ? formatPercent(stats.totals.textDocumentRatio)
                                : '...'
                        }
                    />
                    <Kpi
                        icon={<FileQuestion className='h-4 w-4' />}
                        label='File transfers'
                        value='Not tracked'
                    />
                </MetricGroup>

                <MetricGroup title='Storage'>
                    <Kpi
                        detail='Revision update bytes'
                        icon={<Database className='h-4 w-4' />}
                        label='Revision storage'
                        value={
                            stats
                                ? formatBytes(stats.totals.totalRevisionBytes)
                                : '...'
                        }
                    />
                    <Kpi
                        detail='Mean update payload'
                        icon={<HardDrive className='h-4 w-4' />}
                        label='Avg revision'
                        value={
                            stats
                                ? formatBytes(stats.totals.averageRevisionBytes)
                                : '...'
                        }
                    />
                    <Kpi
                        detail='Revision bytes / active day'
                        icon={<Clock3 className='h-4 w-4' />}
                        label='Daily storage'
                        value={
                            stats
                                ? formatBytes(highlights.bytesPerActiveDay)
                                : '...'
                        }
                    />
                    <Kpi
                        detail={
                            highlights.peakStorageDay
                                ? `${formatBytes(highlights.peakStorageDay.bytes)} stored`
                                : 'No revision bytes'
                        }
                        icon={<FolderTree className='h-4 w-4' />}
                        label='Peak storage day'
                        value={
                            highlights.peakStorageDay
                                ? highlights.peakStorageDay.date
                                : 'None'
                        }
                    />
                </MetricGroup>

                <MetricGroup title='Freshness'>
                    <Kpi
                        detail={`${formatNumber(stats?.totals.activeRootPaths ?? 0)} active in range`}
                        icon={<FolderTree className='h-4 w-4' />}
                        label='Total roots'
                        value={formatStat(stats?.totals.rootPaths)}
                    />
                    <Kpi
                        detail='All-time pads / root'
                        icon={<Gauge className='h-4 w-4' />}
                        label='Pads per root'
                        value={
                            stats
                                ? formatDecimal(stats.totals.averagePadsPerRoot)
                                : '...'
                        }
                    />
                    <Kpi
                        detail={`${formatNumber(stats?.totals.existingRootPaths ?? 0)} existing active roots`}
                        icon={<FolderTree className='h-4 w-4' />}
                        label='New roots'
                        value={formatStat(stats?.totals.rootPathsCreated)}
                    />
                    <Kpi
                        detail='New roots / active roots'
                        icon={<TrendingUp className='h-4 w-4' />}
                        label='Root growth'
                        value={
                            stats
                                ? formatPercent(stats.totals.newRootShare)
                                : '...'
                        }
                    />
                    <Kpi
                        detail={
                            highlights.peakDay
                                ? `${formatNumber(highlights.peakDay.count)} events`
                                : 'No activity'
                        }
                        icon={<Activity className='h-4 w-4' />}
                        label='Peak day'
                        value={
                            highlights.peakDay
                                ? highlights.peakDay.date
                                : 'None'
                        }
                    />
                    <Kpi
                        detail={
                            highlights.peakHour
                                ? `${formatNumber(highlights.peakHour.revisions)} revisions`
                                : 'No revisions'
                        }
                        icon={<Clock3 className='h-4 w-4' />}
                        label='Peak hour'
                        value={
                            highlights.peakHour
                                ? `${highlights.peakHour.hour}:00`
                                : 'None'
                        }
                    />
                    <Kpi
                        detail='Within selected range'
                        icon={<Clock3 className='h-4 w-4' />}
                        label='Last edit'
                        value={formatDateTime(
                            stats?.totals.latestRevisionAt ?? null,
                        )}
                    />
                </MetricGroup>

                <section className='grid gap-4 xl:grid-cols-[1.2fr_0.8fr]'>
                    <ChartCard
                        legend={[
                            ['Created', chartColors.orange],
                            ['Edited', chartColors.cyan],
                        ]}
                        title='Created vs edited'
                    >
                        <ActivityChart series={stats?.series ?? []} />
                    </ChartCard>
                    <ChartCard
                        legend={[
                            ['Text', chartColors.green],
                            ['Drawing', chartColors.purple],
                        ]}
                        title='Revision mix'
                    >
                        <RevisionBars series={stats?.series ?? []} />
                    </ChartCard>
                    <ChartCard title='Revision rhythm'>
                        <HourlyChart series={stats?.hourlyRevisions ?? []} />
                    </ChartCard>
                    <ChartCard title='Document mix'>
                        <DocumentMixChart stats={stats} />
                    </ChartCard>
                    <ChartCard
                        className='xl:col-span-2'
                        legend={[['Bytes', chartColors.orange]]}
                        title='Revision bytes by day'
                    >
                        <StorageChart series={stats?.dailyActivity ?? []} />
                    </ChartCard>
                </section>

                <DailyActivityTable rows={stats?.dailyActivity ?? []} />
            </div>
        </main>
    )

    function setPresetRange(preset: RangePreset) {
        let days = 89
        if (preset === '7d') days = 6
        if (preset === '30d') days = 29
        setFrom(isoDate(addDays(new Date(), -days)))
        setTo(today)
    }
}

function PresetButton({
    preset,
    setRange,
}: {
    preset: RangePreset
    setRange: (preset: RangePreset) => void
}) {
    return (
        <Button onClick={() => setRange(preset)} className='w-14'>
            {preset}
        </Button>
    )
}
