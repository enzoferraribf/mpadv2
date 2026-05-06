import { FileTransferProgress } from '@/features/files/view/progress'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandList,
} from '@/shared/ui/command'
import type { PadPath } from '@mpad/core/pad-path'
import type { LiveFileState } from '@mpad/protocol/live-files'
import { Download, HardDrive, Trash2 } from 'lucide-react'
import { formatFileSize } from './format'

export function FilesDialog(input: {
    open: boolean
    onOpenChange: (open: boolean) => void
    path: PadPath
    files: LiveFileState[]
    onDelete: (id: string) => void
    onDownload: (file: LiveFileState) => void
}) {
    return (
        <CommandDialog
            open={input.open}
            onOpenChange={input.onOpenChange}
            title='Live files dialog'
            description='Search and manage live files for this pad.'
        >
            <CommandInput placeholder={`Search live files in ${input.path}`} />
            <CommandList>
                {input.files.length === 0 ? (
                    <CommandEmpty>No live files in {input.path}.</CommandEmpty>
                ) : (
                    <CommandGroup heading={`Files (${input.files.length})`}>
                        <div className='dialog-scroll max-h-[36rem] overflow-y-auto px-2 pb-2'>
                            {input.files.map((file) => (
                                <div
                                    key={file.meta.id}
                                    className='mb-3 flex items-center justify-between gap-4 rounded-md border border-[--stone-border] bg-[--stone-elevated] p-4'
                                >
                                    <div className='flex min-w-0 flex-1 items-start gap-3'>
                                        <span className='command-icon-wrap'>
                                            <HardDrive className='h-4 w-4' />
                                        </span>
                                        <div className='flex min-w-0 flex-1 flex-col space-y-1'>
                                            <span className='truncate text-sm font-medium text-[--stone-text]'>
                                                {file.meta.name}
                                            </span>
                                            <span className='text-xs text-[--stone-text-dim]'>
                                                {formatFileSize(
                                                    file.meta.sizeBytes,
                                                )}
                                            </span>
                                            <span className='text-xs text-[--stone-text-dim]'>
                                                {file.owners.length} seeder
                                                {file.owners.length === 1
                                                    ? ''
                                                    : 's'}
                                                {file.kind === 'transferring' &&
                                                file.transfer.kind ===
                                                    'downloading'
                                                    ? ` · receiving ${formatFileSize(file.transfer.receivedBytes)}`
                                                    : null}
                                                {file.kind === 'transferring' &&
                                                file.transfer.kind ===
                                                    'uploading'
                                                    ? ` · sending ${formatFileSize(file.transfer.sentBytes)}`
                                                    : null}
                                            </span>
                                            <FileTransferProgress file={file} />
                                        </div>
                                    </div>
                                    <div className='ml-4 flex gap-2'>
                                        <button
                                            onClick={() =>
                                                input.onDownload(file)
                                            }
                                            type='button'
                                            disabled={
                                                file.kind === 'transferring'
                                            }
                                            className='inline-flex items-center justify-center gap-2 rounded-md border border-[--stone-border] bg-[--stone-elevated] px-3 py-2 text-sm font-medium text-[--stone-text] transition-colors hover:bg-[--stone-elevated]/80 disabled:pointer-events-none disabled:opacity-50'
                                        >
                                            <Download className='h-4 w-4' />
                                            {readDownloadLabel(file)}
                                        </button>
                                        {file.isLocal ? (
                                            <button
                                                onClick={() =>
                                                    input.onDelete(file.meta.id)
                                                }
                                                type='button'
                                                className='inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90'
                                            >
                                                <Trash2 className='h-4 w-4' />
                                                Remove
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CommandGroup>
                )}
            </CommandList>
        </CommandDialog>
    )
}

function readDownloadLabel(file: LiveFileState) {
    if (file.kind === 'transferring') {
        return file.transfer.kind === 'downloading' ? 'Downloading' : 'Sending'
    }

    return file.isLocal ? 'Download' : 'Get'
}
