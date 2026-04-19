import { Button } from '@/components/ui/button'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandList,
} from '@/components/ui/command'
import { formatFileSize } from '@/lib/file'
import { FileTransferProgress } from '@/live-files/view/file-transfer-progress'
import type { PadPath } from '@mpad/core/pad-path'
import type { LiveFileState } from '@mpad/protocol/live-files'
import { Download, HardDrive, Trash2 } from 'lucide-react'

export function FilesDialog(input: {
    open: boolean
    onOpenChange: (open: boolean) => void
    path: PadPath
    files: LiveFileState[]
    onDelete: (id: string) => void
    onDownload: (file: LiveFileState) => void
}) {
    return (
        <CommandDialog open={input.open} onOpenChange={input.onOpenChange}>
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
                                        <Button
                                            onClick={() =>
                                                input.onDownload(file)
                                            }
                                            variant='outline'
                                            size='sm'
                                            disabled={
                                                file.kind === 'transferring'
                                            }
                                            className='border-[--stone-border] bg-[--stone-elevated] text-[--stone-text] hover:bg-[--stone-elevated]/80'
                                        >
                                            <Download className='h-4 w-4' />
                                            {readDownloadLabel(file)}
                                        </Button>
                                        {file.isLocal ? (
                                            <Button
                                                onClick={() =>
                                                    input.onDelete(file.meta.id)
                                                }
                                                variant='destructive'
                                                size='sm'
                                            >
                                                <Trash2 className='h-4 w-4' />
                                                Remove
                                            </Button>
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
