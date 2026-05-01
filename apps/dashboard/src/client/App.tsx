import type { DashboardStats, HourPoint, MetricPoint } from '@/shared/stats'
import {
    Activity,
    Brush,
    Clock3,
    Database,
    FileQuestion,
    FileText,
    RefreshCw,
    SquarePen,
    Timer,
} from 'lucide-react'
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
import {
    addDays,
    formatBytes,
    formatDateTime,
    formatNumber,
    isoDate,
} from './lib'
import { Button, Card, Input, Table } from './ui'

type RangePreset = '7d' | '30d' | '90d'

const today = isoDate(new Date())

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

    const topEditedRows = useMemo(
        () =>
            stats?.topEditedPads.map((row) => [
                row.path,
                formatNumber(row.count),
            ]) ?? [],
        [stats],
    )
    const rootRows = useMemo(
        () =>
            stats?.busiestRootPaths.map((row) => [
                row.path,
                formatNumber(row.count),
            ]) ?? [],
        [stats],
    )
    const totalRevisions =
        (stats?.totals.textRevisions ?? 0) +
        (stats?.totals.drawingRevisions ?? 0)
    const revisionDensity =
        stats && stats.totals.padsEdited > 0
            ? totalRevisions / stats.totals.padsEdited
            : 0
    const peakDay = useMemo(() => readPeakDay(stats?.series ?? []), [stats])
    const peakHour = useMemo(
        () => readPeakHour(stats?.hourlyRevisions ?? []),
        [stats],
    )

    return (
        <main className='mx-auto flex min-h-svh max-w-7xl flex-col gap-5 px-5 py-5'>
            <header className='flex flex-wrap items-end justify-between gap-3'>
                <div>
                    <h1 className='text-2xl font-semibold tracking-normal'>
                        Mpad Dashboard
                    </h1>
                    <p className='text-sm text-muted-foreground'>
                        {stats
                            ? `${stats.range.from} to ${stats.range.to} (${stats.range.timezone})`
                            : 'Loading stats'}
                    </p>
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
                    <Button onClick={() => setRefreshKey((value) => value + 1)}>
                        <RefreshCw className='h-4 w-4' />
                        Refresh
                    </Button>
                </div>
            </header>

            {status === 'error' ? (
                <Card className='border-red-200 bg-red-50 p-4 text-sm text-red-800'>
                    {error}
                </Card>
            ) : null}

            <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                <Kpi
                    icon={<SquarePen className='h-4 w-4' />}
                    label='Pads created'
                    value={stats?.totals.padsCreated}
                    detail={
                        stats
                            ? `${formatNumber(stats.totals.totalPads)} total`
                            : undefined
                    }
                />
                <Kpi
                    icon={<Activity className='h-4 w-4' />}
                    label='Pads edited'
                    value={stats?.totals.padsEdited}
                    detail={
                        stats
                            ? `${revisionDensity.toFixed(1)} revs / pad`
                            : undefined
                    }
                />
                <Kpi
                    icon={<FileText className='h-4 w-4' />}
                    label='Text revisions'
                    value={stats?.totals.textRevisions}
                />
                <Kpi
                    icon={<Brush className='h-4 w-4' />}
                    label='Drawing revisions'
                    value={stats?.totals.drawingRevisions}
                />
                <Kpi
                    icon={<Clock3 className='h-4 w-4' />}
                    label='Text docs'
                    value={stats?.totals.textDocuments}
                    detail={
                        stats
                            ? `${formatNumber(stats.totals.rootPaths)} roots`
                            : undefined
                    }
                />
                <Kpi
                    icon={<Database className='h-4 w-4' />}
                    label='Revision storage'
                    value={
                        stats
                            ? formatBytes(stats.totals.totalRevisionBytes)
                            : undefined
                    }
                    raw
                    detail={
                        stats
                            ? `${formatBytes(
                                  stats.totals.averageRevisionBytes,
                              )} avg`
                            : undefined
                    }
                />
                <Kpi
                    icon={<Brush className='h-4 w-4' />}
                    label='Drawing docs'
                    value={stats?.totals.drawingDocuments}
                    detail={
                        stats
                            ? `${formatNumber(
                                  stats.totals.rootPathsCreated,
                              )} new roots`
                            : undefined
                    }
                />
                <Kpi
                    icon={<FileQuestion className='h-4 w-4' />}
                    label='File transfers'
                    value='Not tracked'
                    raw
                />
                <Kpi
                    icon={<Timer className='h-4 w-4' />}
                    label='Active days'
                    value={stats?.totals.activeDays}
                    detail={
                        stats
                            ? `${formatNumber(stats.series.length)} days selected`
                            : undefined
                    }
                />
            </section>

            <section className='grid gap-3 lg:grid-cols-[1.2fr_0.9fr]'>
                <Card className='p-4'>
                    <div className='mb-3 flex items-center justify-between gap-3'>
                        <h2 className='text-sm font-semibold'>
                            Created vs edited
                        </h2>
                        <Legend
                            items={[
                                ['Created', '#0f766e'],
                                ['Edited', '#b45309'],
                            ]}
                        />
                    </div>
                    <ActivityChart series={stats?.series ?? []} />
                </Card>
                <Card className='p-4'>
                    <div className='mb-3 flex items-center justify-between gap-3'>
                        <h2 className='text-sm font-semibold'>Revision mix</h2>
                        <Legend
                            items={[
                                ['Text', '#2563eb'],
                                ['Drawing', '#9333ea'],
                            ]}
                        />
                    </div>
                    <RevisionBars series={stats?.series ?? []} />
                </Card>
                <Card className='p-4 lg:col-span-2'>
                    <div className='mb-3 flex items-center justify-between gap-3'>
                        <h2 className='text-sm font-semibold'>
                            Revision rhythm
                        </h2>
                        <span className='text-xs text-muted-foreground'>
                            Local hour
                        </span>
                    </div>
                    <HourlyChart series={stats?.hourlyRevisions ?? []} />
                </Card>
            </section>

            <section className='grid gap-3 lg:grid-cols-4'>
                <Insight
                    label='Peak day'
                    value={peakDay ? peakDay.date : 'None'}
                    detail={
                        peakDay
                            ? `${formatNumber(peakDay.count)} total events`
                            : 'No activity in range'
                    }
                />
                <Insight
                    label='Peak hour'
                    value={peakHour ? `${peakHour.hour}:00` : 'None'}
                    detail={
                        peakHour
                            ? `${formatNumber(peakHour.revisions)} revisions`
                            : 'No revisions in range'
                    }
                />
                <Insight
                    label='Document mix'
                    value={`${formatNumber(stats?.totals.textDocuments ?? 0)} text`}
                    detail={`${formatNumber(stats?.totals.drawingDocuments ?? 0)} drawing`}
                >
                    <DocumentMixChart stats={stats} />
                </Insight>
                <Insight
                    label='Root growth'
                    value={formatNumber(stats?.totals.rootPathsCreated ?? 0)}
                    detail={`${formatNumber(stats?.totals.rootPaths ?? 0)} total roots`}
                />
                <Insight
                    label='Last edit'
                    value={formatDateTime(
                        stats?.totals.latestRevisionAt ?? null,
                    )}
                    detail='Within selected range'
                />
            </section>

            <section className='grid gap-3 lg:grid-cols-3'>
                <Card className='p-4'>
                    <h2 className='mb-3 text-sm font-semibold'>
                        Daily activity
                    </h2>
                    <Table
                        columns={[
                            'Date',
                            'Created',
                            'Edited',
                            'Text',
                            'Drawing',
                        ]}
                        rows={
                            stats?.series.map((row) => [
                                row.date,
                                formatNumber(row.padsCreated),
                                formatNumber(row.padsEdited),
                                formatNumber(row.textRevisions),
                                formatNumber(row.drawingRevisions),
                            ]) ?? []
                        }
                        empty='No activity in range'
                    />
                </Card>
                <Card className='p-4'>
                    <h2 className='mb-3 text-sm font-semibold'>
                        Top edited pads
                    </h2>
                    <Table
                        columns={['Path', 'Revisions']}
                        rows={topEditedRows}
                        empty='No edits in range'
                    />
                </Card>
                <Card className='p-4'>
                    <h2 className='mb-3 text-sm font-semibold'>Active roots</h2>
                    <Table
                        columns={['Root', 'Revisions']}
                        rows={rootRows}
                        empty='No edits in range'
                    />
                </Card>
            </section>
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

function Kpi({
    icon,
    label,
    value,
    detail,
    raw = false,
}: {
    icon: React.ReactNode
    label: string
    value: number | string | undefined
    detail?: string
    raw?: boolean
}) {
    let displayValue: React.ReactNode = '...'
    if (value !== undefined) {
        displayValue = raw ? value : formatNumber(Number(value))
    }

    return (
        <Card className='p-4'>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                {icon}
                {label}
            </div>
            <div className='mt-3 text-2xl font-semibold'>{displayValue}</div>
            {detail ? (
                <div className='mt-1 text-xs text-muted-foreground'>
                    {detail}
                </div>
            ) : null}
        </Card>
    )
}

function ActivityChart({ series }: { series: MetricPoint[] }) {
    return (
        <div className='h-[260px]'>
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
                                stopColor='#0f766e'
                                stopOpacity={0.24}
                            />
                            <stop
                                offset='95%'
                                stopColor='#0f766e'
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
                                stopColor='#b45309'
                                stopOpacity={0.22}
                            />
                            <stop
                                offset='95%'
                                stopColor='#b45309'
                                stopOpacity={0.02}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        stroke='#d4d9e2'
                        strokeDasharray='3 5'
                        vertical={false}
                    />
                    <XAxis
                        axisLine={false}
                        dataKey='date'
                        minTickGap={22}
                        tickFormatter={formatShortDate}
                        tickLine={false}
                    />
                    <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        width={34}
                    />
                    <Tooltip formatter={tooltipValue} labelFormatter={String} />
                    <Area
                        dataKey='padsCreated'
                        fill='url(#createdFill)'
                        name='Created'
                        stroke='#0f766e'
                        strokeWidth={2}
                        type='monotone'
                    />
                    <Area
                        dataKey='padsEdited'
                        fill='url(#editedFill)'
                        name='Edited'
                        stroke='#b45309'
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
        <div className='h-[260px]'>
            <ResponsiveContainer height='100%' width='100%'>
                <BarChart data={series} margin={chartMargin}>
                    <CartesianGrid
                        stroke='#d4d9e2'
                        strokeDasharray='3 5'
                        vertical={false}
                    />
                    <XAxis
                        axisLine={false}
                        dataKey='date'
                        minTickGap={22}
                        tickFormatter={formatShortDate}
                        tickLine={false}
                    />
                    <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        width={34}
                    />
                    <Tooltip formatter={tooltipValue} labelFormatter={String} />
                    <Bar
                        dataKey='textRevisions'
                        fill='#2563eb'
                        name='Text'
                        radius={[3, 3, 0, 0]}
                        stackId='revisions'
                    />
                    <Bar
                        dataKey='drawingRevisions'
                        fill='#9333ea'
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
        <div className='h-[220px]'>
            <ResponsiveContainer height='100%' width='100%'>
                <BarChart data={series} margin={chartMargin}>
                    <CartesianGrid
                        stroke='#d4d9e2'
                        strokeDasharray='3 5'
                        vertical={false}
                    />
                    <XAxis
                        axisLine={false}
                        dataKey='hour'
                        interval={2}
                        tickFormatter={formatHour}
                        tickLine={false}
                    />
                    <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        width={34}
                    />
                    <Tooltip
                        formatter={tooltipValue}
                        labelFormatter={(value) => `${value}:00`}
                    />
                    <Bar
                        dataKey='revisions'
                        fill='#0f766e'
                        name='Revisions'
                        radius={[3, 3, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

function Legend({ items }: { items: Array<[string, string]> }) {
    return (
        <div className='flex flex-wrap gap-3 text-xs text-muted-foreground'>
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

function Insight({
    label,
    value,
    detail,
    children,
}: {
    label: string
    value: string
    detail: string
    children?: React.ReactNode
}) {
    return (
        <Card className='p-4'>
            <div className='text-sm text-muted-foreground'>{label}</div>
            <div className='mt-2 text-xl font-semibold'>{value}</div>
            <div className='mt-1 text-sm text-muted-foreground'>{detail}</div>
            {children ? <div className='mt-4'>{children}</div> : null}
        </Card>
    )
}

function DocumentMixChart({ stats }: { stats: DashboardStats | null }) {
    const data = [
        { name: 'Text', value: stats?.totals.textDocuments ?? 0 },
        { name: 'Drawing', value: stats?.totals.drawingDocuments ?? 0 },
    ]
    const hasData = data.some((item) => item.value > 0)

    return (
        <div className='h-[120px]'>
            {hasData ? (
                <ResponsiveContainer height='100%' width='100%'>
                    <PieChart>
                        <Pie
                            cx='50%'
                            cy='50%'
                            data={data}
                            dataKey='value'
                            innerRadius={32}
                            outerRadius={52}
                            paddingAngle={2}
                        >
                            <Cell fill='#2563eb' />
                            <Cell fill='#9333ea' />
                        </Pie>
                        <Tooltip formatter={tooltipValue} />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className='flex h-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground'>
                    No documents
                </div>
            )}
        </div>
    )
}

function readPeakDay(series: MetricPoint[]) {
    let best: { date: string; count: number } | null = null
    for (const point of series) {
        const count =
            point.padsCreated +
            point.padsEdited +
            point.textRevisions +
            point.drawingRevisions
        if (!best || count > best.count) best = { date: point.date, count }
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

const chartMargin = { bottom: 0, left: 0, right: 8, top: 8 }

function tooltipValue(value: unknown) {
    return formatNumber(Number(value))
}

function formatShortDate(value: string) {
    return value.slice(5)
}

function formatHour(value: number) {
    return `${value}`
}
