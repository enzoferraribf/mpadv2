import type {
    DailyActivityRow,
    DashboardStats,
    HourPoint,
    MetricPoint,
    PadActivityRow,
    RevisionPathRow,
    RootActivityRow,
    RootPadsRow,
    StalePadRow,
} from '@/shared/stats'
import type { ColumnDef } from '@tanstack/react-table'
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
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { DataTable } from './data-table'
import {
    addDays,
    formatBytes,
    formatDateTime,
    formatDecimal,
    formatNumber,
    formatPercent,
    isoDate,
} from './lib'
import { Button, Card, Input } from './ui'

type RangePreset = '7d' | '30d' | '90d'

const today = isoDate(new Date())
const orange = '#FC9867'
const cyan = '#78DCE8'
const green = '#A9DC76'
const purple = '#AB9DF2'
const chartGrid = '#3B3B34'
const chartText = '#B8B8AA'
const tooltipStyle = {
    backgroundColor: '#23231D',
    border: '1px solid #3B3B34',
    borderRadius: 6,
    color: '#F8F8F2',
}

export function App() {
    const [from, setFrom] = useState(isoDate(addDays(new Date(), -29)))
    const [to, setTo] = useState(today)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading',
    )
    const [error, setError] = useState<string | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        setStatus('loading')
        setError(null)
        fetch(`/api/stats?from=${from}&to=${to}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                const body = await response.json()
                if (!response.ok)
                    throw new Error(body.error ?? 'Request failed')
                setStats(body)
                setStatus('ready')
            })
            .catch((cause) => {
                if (controller.signal.aborted) return
                setError(
                    cause instanceof Error ? cause.message : 'Request failed',
                )
                setStatus('error')
            })
        return () => controller.abort()
    }, [from, refreshKey, to])

    const dailyColumns = useDailyColumns()
    const revisionPathColumns = useRevisionPathColumns()
    const rootActivityColumns = useRootActivityColumns()
    const rootPadsColumns = useRootPadsColumns()
    const padActivityColumns = usePadActivityColumns()
    const stalePadColumns = useStalePadColumns()
    const peakDay = useMemo(
        () => readPeakDay(stats?.dailyActivity ?? []),
        [stats],
    )
    const peakHour = useMemo(
        () => readPeakHour(stats?.hourlyRevisions ?? []),
        [stats],
    )
    const bytesPerActiveDay =
        stats && stats.totals.activeDays > 0
            ? stats.totals.totalRevisionBytes / stats.totals.activeDays
            : 0

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
                        <Button
                            onClick={() => setRefreshKey((value) => value + 1)}
                        >
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
                        value={stats ? formatBytes(bytesPerActiveDay) : '...'}
                    />
                    <Kpi
                        detail='Heaviest path in range'
                        icon={<FolderTree className='h-4 w-4' />}
                        label='Top storage path'
                        value={
                            stats?.largestRevisionPaths[0]
                                ? formatBytes(
                                      stats.largestRevisionPaths[0]
                                          .revisionBytes,
                                  )
                                : '...'
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
                            peakDay
                                ? `${formatNumber(peakDay.count)} events`
                                : 'No activity'
                        }
                        icon={<Activity className='h-4 w-4' />}
                        label='Peak day'
                        value={peakDay ? peakDay.date : 'None'}
                    />
                    <Kpi
                        detail={
                            peakHour
                                ? `${formatNumber(peakHour.revisions)} revisions`
                                : 'No revisions'
                        }
                        icon={<Clock3 className='h-4 w-4' />}
                        label='Peak hour'
                        value={peakHour ? `${peakHour.hour}:00` : 'None'}
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
                            ['Created', orange],
                            ['Edited', cyan],
                        ]}
                        title='Created vs edited'
                    >
                        <ActivityChart series={stats?.series ?? []} />
                    </ChartCard>
                    <ChartCard
                        legend={[
                            ['Text', green],
                            ['Drawing', purple],
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
                        legend={[['Bytes', orange]]}
                        title='Revision bytes by day'
                    >
                        <StorageChart series={stats?.dailyActivity ?? []} />
                    </ChartCard>
                </section>

                <section className='flex flex-col gap-4'>
                    <DataTable
                        columns={dailyColumns}
                        data={stats?.dailyActivity ?? []}
                        description='Created pads, edited pads, revision mix, and stored revision bytes.'
                        empty='No daily activity in this range'
                        filters={[
                            {
                                label: 'Active only',
                                value: 'active',
                                predicate: (row) => row.totalActivity > 0,
                            },
                        ]}
                        initialSorting={[{ id: 'date', desc: true }]}
                        searchPlaceholder='Search dates'
                        title='Daily activity'
                    />
                    <DataTable
                        columns={revisionPathColumns}
                        data={stats?.topEditedPads ?? []}
                        description='Pads with the most revisions in the selected range.'
                        empty='No edited pads in this range'
                        initialSorting={[{ id: 'revisions', desc: true }]}
                        searchPlaceholder='Search paths'
                        title='Top edited pads'
                    />
                    <DataTable
                        columns={rootActivityColumns}
                        data={stats?.busiestRootPaths ?? []}
                        description='Root paths with the most revision activity.'
                        empty='No active roots in this range'
                        initialSorting={[{ id: 'revisions', desc: true }]}
                        searchPlaceholder='Search roots'
                        title='Active roots'
                    />
                    <DataTable
                        columns={revisionPathColumns}
                        data={stats?.largestRevisionPaths ?? []}
                        description='Paths using the most revision storage in the selected range.'
                        empty='No revision storage in this range'
                        initialSorting={[{ id: 'revisionBytes', desc: true }]}
                        searchPlaceholder='Search paths'
                        title='Top paths by storage'
                    />
                    <DataTable
                        columns={rootPadsColumns}
                        data={stats?.topRootsByPads ?? []}
                        description='Roots with the largest number of pads.'
                        empty='No roots found'
                        initialSorting={[{ id: 'pads', desc: true }]}
                        searchPlaceholder='Search roots'
                        title='Top roots by pad count'
                    />
                    <DataTable
                        columns={padActivityColumns}
                        data={stats?.recentlyActivePads ?? []}
                        description='Pads with the latest revisions in this range.'
                        empty='No recently active pads in this range'
                        initialSorting={[
                            { id: 'latestRevisionAt', desc: true },
                        ]}
                        searchPlaceholder='Search paths'
                        title='Recently active pads'
                    />
                    <DataTable
                        columns={stalePadColumns}
                        data={stats?.stalePads ?? []}
                        description='Pads without revisions in the selected range.'
                        empty='No stale pads found'
                        filters={[
                            {
                                label: 'Never edited',
                                value: 'never',
                                predicate: (row) => row.revisions === 0,
                            },
                        ]}
                        initialSorting={[{ id: 'lastUpdatedAt', desc: false }]}
                        searchPlaceholder='Search paths'
                        title='Stale pads'
                    />
                </section>
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

function MetricGroup({
    children,
    title,
}: {
    children: ReactNode
    title: string
}) {
    return (
        <section>
            <h2 className='mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-[0.16em]'>
                {title}
            </h2>
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                {children}
            </div>
        </section>
    )
}

function Kpi({
    detail,
    icon,
    label,
    value,
}: {
    detail?: string
    icon: ReactNode
    label: string
    value: ReactNode
}) {
    return (
        <Card className='p-4'>
            <div className='flex items-center gap-2 text-muted-foreground text-sm'>
                {icon}
                {label}
            </div>
            <div className='mt-3 truncate font-semibold text-2xl'>{value}</div>
            {detail ? (
                <div className='mt-1 truncate text-muted-foreground text-xs'>
                    {detail}
                </div>
            ) : null}
        </Card>
    )
}

function ChartCard({
    children,
    className,
    legend,
    title,
}: {
    children: ReactNode
    className?: string
    legend?: Array<[string, string]>
    title: string
}) {
    return (
        <Card className={className}>
            <div className='flex flex-wrap items-center justify-between gap-3 border-border border-b px-4 py-3'>
                <h2 className='font-semibold text-sm'>{title}</h2>
                {legend ? <Legend items={legend} /> : null}
            </div>
            <div className='p-4'>{children}</div>
        </Card>
    )
}

function ActivityChart({ series }: { series: MetricPoint[] }) {
    return (
        <div className='h-[280px]'>
            <ResponsiveContainer height='100%' width='100%'>
                <AreaChart data={series} margin={chartMargin}>
                    <defs>
                        <linearGradient
                            id='createdFill'
                            x1='0'
                            x2='0'
                            y1='0'
                            y2='1'
                        >
                            <stop
                                offset='5%'
                                stopColor={orange}
                                stopOpacity={0.3}
                            />
                            <stop
                                offset='95%'
                                stopColor={orange}
                                stopOpacity={0.02}
                            />
                        </linearGradient>
                        <linearGradient
                            id='editedFill'
                            x1='0'
                            x2='0'
                            y1='0'
                            y2='1'
                        >
                            <stop
                                offset='5%'
                                stopColor={cyan}
                                stopOpacity={0.28}
                            />
                            <stop
                                offset='95%'
                                stopColor={cyan}
                                stopOpacity={0.02}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        stroke={chartGrid}
                        strokeDasharray='3 5'
                        vertical={false}
                    />
                    <XAxis
                        axisLine={false}
                        dataKey='date'
                        minTickGap={22}
                        padding={dateAxisPadding}
                        stroke={chartText}
                        tickFormatter={formatShortDate}
                        tickLine={false}
                        tickMargin={8}
                    />
                    <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        stroke={chartText}
                        tickLine={false}
                        tickMargin={8}
                        width={56}
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={tooltipNumber}
                        labelStyle={{ color: '#F8F8F2' }}
                    />
                    <Area
                        dataKey='padsCreated'
                        fill='url(#createdFill)'
                        name='Created'
                        stroke={orange}
                        strokeWidth={2}
                        type='monotone'
                    />
                    <Area
                        dataKey='padsEdited'
                        fill='url(#editedFill)'
                        name='Edited'
                        stroke={cyan}
                        strokeWidth={2}
                        type='monotone'
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

function RevisionBars({ series }: { series: MetricPoint[] }) {
    return (
        <div className='h-[280px]'>
            <ResponsiveContainer height='100%' width='100%'>
                <BarChart data={series} margin={chartMargin}>
                    <CartesianGrid
                        stroke={chartGrid}
                        strokeDasharray='3 5'
                        vertical={false}
                    />
                    <XAxis
                        axisLine={false}
                        dataKey='date'
                        minTickGap={22}
                        padding={dateAxisPadding}
                        stroke={chartText}
                        tickFormatter={formatShortDate}
                        tickLine={false}
                        tickMargin={8}
                    />
                    <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        stroke={chartText}
                        tickLine={false}
                        tickMargin={8}
                        width={56}
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={tooltipNumber}
                        labelStyle={{ color: '#F8F8F2' }}
                    />
                    <Bar
                        dataKey='textRevisions'
                        fill={green}
                        name='Text'
                        radius={[3, 3, 0, 0]}
                        stackId='revisions'
                    />
                    <Bar
                        dataKey='drawingRevisions'
                        fill={purple}
                        name='Drawing'
                        radius={[3, 3, 0, 0]}
                        stackId='revisions'
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function HourlyChart({ series }: { series: HourPoint[] }) {
    return (
        <div className='h-[260px]'>
            <ResponsiveContainer height='100%' width='100%'>
                <BarChart data={series} margin={chartMargin}>
                    <CartesianGrid
                        stroke={chartGrid}
                        strokeDasharray='3 5'
                        vertical={false}
                    />
                    <XAxis
                        axisLine={false}
                        dataKey='hour'
                        interval={2}
                        stroke={chartText}
                        tickFormatter={formatHour}
                        tickLine={false}
                        tickMargin={8}
                    />
                    <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        stroke={chartText}
                        tickLine={false}
                        tickMargin={8}
                        width={56}
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={tooltipNumber}
                        labelFormatter={(value) => `${value}:00`}
                        labelStyle={{ color: '#F8F8F2' }}
                    />
                    <Bar
                        dataKey='revisions'
                        fill={cyan}
                        name='Revisions'
                        radius={[3, 3, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function StorageChart({ series }: { series: DailyActivityRow[] }) {
    return (
        <div className='h-[260px]'>
            <ResponsiveContainer height='100%' width='100%'>
                <BarChart data={series} margin={chartMargin}>
                    <CartesianGrid
                        stroke={chartGrid}
                        strokeDasharray='3 5'
                        vertical={false}
                    />
                    <XAxis
                        axisLine={false}
                        dataKey='date'
                        minTickGap={22}
                        padding={dateAxisPadding}
                        stroke={chartText}
                        tickFormatter={formatShortDate}
                        tickLine={false}
                        tickMargin={8}
                    />
                    <YAxis
                        axisLine={false}
                        stroke={chartText}
                        tickFormatter={(value) => formatBytes(Number(value))}
                        tickLine={false}
                        tickMargin={8}
                        width={78}
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => formatBytes(Number(value))}
                        labelStyle={{ color: '#F8F8F2' }}
                    />
                    <Bar
                        dataKey='revisionBytes'
                        fill={orange}
                        name='Bytes'
                        radius={[3, 3, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function DocumentMixChart({ stats }: { stats: DashboardStats | null }) {
    const data = [
        { name: 'Text', value: stats?.totals.textDocuments ?? 0 },
        { name: 'Drawing', value: stats?.totals.drawingDocuments ?? 0 },
    ]
    const hasData = data.some((item) => item.value > 0)

    return (
        <div className='h-[260px]'>
            {hasData ? (
                <ResponsiveContainer height='100%' width='100%'>
                    <PieChart>
                        <Pie
                            cx='50%'
                            cy='50%'
                            data={data}
                            dataKey='value'
                            innerRadius={58}
                            outerRadius={94}
                            paddingAngle={2}
                        >
                            <Cell fill={green} />
                            <Cell fill={purple} />
                        </Pie>
                        <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={tooltipNumber}
                            labelStyle={{ color: '#F8F8F2' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className='flex h-full items-center justify-center rounded-md bg-muted text-muted-foreground text-sm'>
                    No documents
                </div>
            )}
        </div>
    )
}

function Legend({ items }: { items: Array<[string, string]> }) {
    return (
        <div className='flex flex-wrap gap-3 text-muted-foreground text-xs'>
            {items.map(([label, color]) => (
                <span key={label} className='inline-flex items-center gap-1.5'>
                    <span
                        className='h-2.5 w-2.5 rounded-sm'
                        style={{ backgroundColor: color }}
                    />
                    {label}
                </span>
            ))}
        </div>
    )
}

function useDailyColumns() {
    return useMemo<ColumnDef<DailyActivityRow>[]>(
        () => [
            { accessorKey: 'date', header: 'Date' },
            {
                accessorKey: 'padsCreated',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Created',
            },
            {
                accessorKey: 'padsEdited',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Edited',
            },
            {
                accessorKey: 'textRevisions',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Text revs',
            },
            {
                accessorKey: 'drawingRevisions',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Drawing revs',
            },
            {
                accessorKey: 'revisionBytes',
                cell: ({ getValue }) => formatBytes(Number(getValue())),
                header: 'Bytes',
            },
            {
                accessorKey: 'totalActivity',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Total',
            },
        ],
        [],
    )
}

function useRevisionPathColumns() {
    return useMemo<ColumnDef<RevisionPathRow>[]>(
        () => [
            {
                accessorKey: 'path',
                cell: ({ getValue }) => <PathCell value={String(getValue())} />,
                header: 'Path',
            },
            {
                accessorKey: 'revisions',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Revisions',
            },
            {
                accessorKey: 'revisionBytes',
                cell: ({ getValue }) => formatBytes(Number(getValue())),
                header: 'Bytes',
            },
            {
                accessorKey: 'latestRevisionAt',
                cell: ({ getValue }) =>
                    formatDateTime(getValue<string | null>()),
                header: 'Latest edit',
            },
        ],
        [],
    )
}

function useRootActivityColumns() {
    return useMemo<ColumnDef<RootActivityRow>[]>(
        () => [
            {
                accessorKey: 'path',
                cell: ({ getValue }) => <PathCell value={String(getValue())} />,
                header: 'Root',
            },
            {
                accessorKey: 'revisions',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Revisions',
            },
            {
                accessorKey: 'pads',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Pads',
            },
        ],
        [],
    )
}

function useRootPadsColumns() {
    return useMemo<ColumnDef<RootPadsRow>[]>(
        () => [
            {
                accessorKey: 'path',
                cell: ({ getValue }) => <PathCell value={String(getValue())} />,
                header: 'Root',
            },
            {
                accessorKey: 'pads',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Pads',
            },
            {
                accessorKey: 'latestPadCreatedAt',
                cell: ({ getValue }) =>
                    formatDateTime(getValue<string | null>()),
                header: 'Latest pad',
            },
        ],
        [],
    )
}

function usePadActivityColumns() {
    return useMemo<ColumnDef<PadActivityRow>[]>(
        () => [
            {
                accessorKey: 'path',
                cell: ({ getValue }) => <PathCell value={String(getValue())} />,
                header: 'Path',
            },
            {
                accessorKey: 'latestRevisionAt',
                cell: ({ getValue }) =>
                    formatDateTime(getValue<string | null>()),
                header: 'Latest edit',
            },
            {
                accessorKey: 'revisions',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Revisions',
            },
        ],
        [],
    )
}

function useStalePadColumns() {
    return useMemo<ColumnDef<StalePadRow>[]>(
        () => [
            {
                accessorKey: 'path',
                cell: ({ getValue }) => <PathCell value={String(getValue())} />,
                header: 'Path',
            },
            {
                accessorKey: 'lastUpdatedAt',
                cell: ({ getValue }) =>
                    formatDateTime(getValue<string | null>()),
                header: 'Last update',
            },
            {
                accessorKey: 'revisions',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'All-time revisions',
            },
        ],
        [],
    )
}

function PathCell({ value }: { value: string }) {
    return (
        <span className='block max-w-[52rem] truncate font-mono text-xs text-foreground'>
            {value}
        </span>
    )
}

function readPeakDay(series: DailyActivityRow[]) {
    let best: { date: string; count: number } | null = null
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

function formatStat(value: number | undefined) {
    return value === undefined ? '...' : formatNumber(value)
}

const chartMargin = { bottom: 8, left: 10, right: 22, top: 12 }
const dateAxisPadding = { left: 8, right: 16 }

function tooltipNumber(value: unknown) {
    return formatNumber(Number(value))
}

function formatShortDate(value: string) {
    return value.slice(5)
}

function formatHour(value: number) {
    return `${value}`
}
