import type { HistogramBin } from '@/shared/stats'

export function buildHistogram(
    values: number[],
    edges: number[],
): HistogramBin[] {
    return edges.map((edge, index) => {
        const next = edges[index + 1]
        const label = next === undefined ? `${edge}+` : `${edge}-${next - 1}`
        const count = values.filter((value) =>
            next === undefined ? value >= edge : value >= edge && value < next,
        ).length
        return { label, count }
    })
}
