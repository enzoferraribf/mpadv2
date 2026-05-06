import type { DashboardStats } from '@/shared/stats'
import { useEffect, useState } from 'react'

export type DashboardStatus = 'loading' | 'ready' | 'error'

export function useDashboardStats(from: string, to: string) {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [status, setStatus] = useState<DashboardStatus>('loading')
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

    return {
        error,
        refresh() {
            setRefreshKey((value) => value + 1)
        },
        stats,
        status,
    }
}
