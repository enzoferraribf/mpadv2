import type { ReactNode } from 'react'
import { formatNumber } from './lib'
import { Card } from './ui'

export function MetricGroup({
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

export function Kpi({
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

export function formatStat(value: number | undefined) {
    return value === undefined ? '...' : formatNumber(value)
}
