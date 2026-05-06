import type {
    DailyActivityRow,
    DashboardStats,
    HourPoint,
    MetricPoint,
} from '@/shared/stats'
import type { ReactNode } from 'react'
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
import { formatBytes, formatNumber } from './lib'
import { Card } from './ui'

export const chartColors = {
    cyan: '#78DCE8',
    green: '#A9DC76',
    orange: '#FC9867',
    purple: '#AB9DF2',
}

const chartGrid = '#3B3B34'
const chartText = '#B8B8AA'
const chartMargin = { bottom: 8, left: 10, right: 22, top: 12 }
const dateAxisPadding = { left: 8, right: 16 }
const tooltipStyle = {
    backgroundColor: '#23231D',
    border: '1px solid #3B3B34',
    borderRadius: 6,
    color: '#F8F8F2',
}

export function ChartCard({
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

export function ActivityChart({ series }: { series: MetricPoint[] }) {
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
                                stopColor={chartColors.orange}
                                stopOpacity={0.3}
                            />
                            <stop
                                offset='95%'
                                stopColor={chartColors.orange}
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
                                stopColor={chartColors.cyan}
                                stopOpacity={0.28}
                            />
                            <stop
                                offset='95%'
                                stopColor={chartColors.cyan}
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
                        stroke={chartColors.orange}
                        strokeWidth={2}
                        type='monotone'
                    />
                    <Area
                        dataKey='padsEdited'
                        fill='url(#editedFill)'
                        name='Edited'
                        stroke={chartColors.cyan}
                        strokeWidth={2}
                        type='monotone'
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

export function RevisionBars({ series }: { series: MetricPoint[] }) {
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
                        fill={chartColors.green}
                        name='Text'
                        radius={[3, 3, 0, 0]}
                        stackId='revisions'
                    />
                    <Bar
                        dataKey='drawingRevisions'
                        fill={chartColors.purple}
                        name='Drawing'
                        radius={[3, 3, 0, 0]}
                        stackId='revisions'
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

export function HourlyChart({ series }: { series: HourPoint[] }) {
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
                        fill={chartColors.cyan}
                        name='Revisions'
                        radius={[3, 3, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

export function StorageChart({ series }: { series: DailyActivityRow[] }) {
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
                        fill={chartColors.orange}
                        name='Bytes'
                        radius={[3, 3, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

export function DocumentMixChart({ stats }: { stats: DashboardStats | null }) {
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
                            <Cell fill={chartColors.green} />
                            <Cell fill={chartColors.purple} />
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

function tooltipNumber(value: unknown) {
    return formatNumber(Number(value))
}

function formatShortDate(value: string) {
    return value.slice(5)
}

function formatHour(value: number) {
    return `${value}`
}
