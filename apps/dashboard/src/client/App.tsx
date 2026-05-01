import type { DashboardStats } from '@/shared/stats'
import {
    Activity,
    Brush,
    Clock3,
    Database,
    FileQuestion,
    FileText,
    RefreshCw,
    SquarePen,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { addDays, formatBytes, formatNumber, isoDate } from './lib'
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
                />
                <Kpi
                    icon={<Activity className='h-4 w-4' />}
                    label='Pads edited'
                    value={stats?.totals.padsEdited}
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
                />
                <Kpi
                    icon={<Brush className='h-4 w-4' />}
                    label='Drawing docs'
                    value={stats?.totals.drawingDocuments}
                />
                <Kpi
                    icon={<FileQuestion className='h-4 w-4' />}
                    label='File transfers'
                    value='Not tracked'
                    raw
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
    raw = false,
}: {
    icon: React.ReactNode
    label: string
    value: number | string | undefined
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
        </Card>
    )
}
