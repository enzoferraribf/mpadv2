import type { LiveFileState } from '@mmpad/shared'
import { formatFileSize } from '@/lib/file'

export function FileTransferProgress(input: { file: LiveFileState; compact?: boolean }) {
    if (input.file.kind !== 'transferring') return null

    const transferredBytes = input.file.transfer.kind === 'downloading'
        ? input.file.transfer.receivedBytes
        : input.file.transfer.sentBytes
    const totalBytes = Math.max(input.file.meta.sizeBytes, 1)
    const progress = Math.max(0, Math.min(100, (transferredBytes / totalBytes) * 100))
    const label = input.file.transfer.kind === 'downloading' ? 'Receiving' : 'Sending'
    const detail = `${formatFileSize(transferredBytes)} / ${formatFileSize(input.file.meta.sizeBytes)}`
    const progressLabel = `${label} ${Math.round(progress)}%`

    if (input.compact) {
        return (
            <div className="mt-3 flex w-full flex-col items-center gap-1.5 px-3">
                <div className="w-full max-w-[160px] text-center text-[10px] font-medium uppercase tracking-[0.04em] text-[--stone-text-dim]">
                    <span>{progressLabel}</span>
                </div>
                <div
                    className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-[--stone-border]"
                    role="progressbar"
                    aria-label={`${label} ${input.file.meta.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                >
                    <div
                        className="h-full rounded-full bg-[--stone-accent]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="pt-2">
            <div className="flex items-center justify-between gap-3 text-xs text-[--stone-text-dim]">
                <span>{label}</span>
                <span className="whitespace-nowrap">{detail}</span>
            </div>
            <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[--stone-border]"
                role="progressbar"
                aria-label={`${label} ${input.file.meta.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
            >
                <div
                    className="h-full rounded-full bg-[--stone-accent]"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    )
}
