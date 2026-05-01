import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatNumber(value: number) {
    return new Intl.NumberFormat('en-GB').format(value)
}

export function formatDecimal(value: number, digits = 1) {
    return new Intl.NumberFormat('en-GB', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
    }).format(value)
}

export function formatPercent(value: number) {
    return `${formatDecimal(value)}%`
}

export function formatBytes(value: number) {
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
    return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export function formatDateTime(value: string | null) {
    if (!value) return 'None'
    return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value))
}

export function isoDate(date: Date) {
    return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, amount: number) {
    const next = new Date(date)
    next.setUTCDate(next.getUTCDate() + amount)
    return next
}
