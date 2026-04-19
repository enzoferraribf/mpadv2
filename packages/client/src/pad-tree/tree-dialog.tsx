import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import { type PadPath, rootPadPath } from '@mpad/core/pad-path'
import type { PadTreeItem } from '@mpad/protocol/pad-tree'
import { FolderTree } from 'lucide-react'

export function TreeDialog(input: {
    open: boolean
    onOpenChange: (open: boolean) => void
    path: PadPath
    tree: PadTreeItem[]
    errorMessage?: string | null
    onSelect: (path: PadPath) => void
}) {
    const items = input.tree.filter((item) => item.path !== input.path)
    const scopePath = rootPadPath(input.path)

    return (
        <CommandDialog open={input.open} onOpenChange={input.onOpenChange}>
            <CommandInput placeholder={`Search pads in ${scopePath}`} />
            <CommandList>
                {items.length === 0 ? (
                    <CommandEmpty>
                        {input.errorMessage ?? 'No related pads.'}
                    </CommandEmpty>
                ) : (
                    <CommandGroup heading='Explorer'>
                        {items.map((item) => (
                            <CommandItem
                                key={item.path}
                                onSelect={() => input.onSelect(item.path)}
                                className='gap-3'
                            >
                                <span className='command-icon-wrap'>
                                    <FolderTree className='h-4 w-4' />
                                </span>
                                <div className='min-w-0 space-y-1 py-2'>
                                    <span className='command-heading'>
                                        {item.name}
                                    </span>
                                    <span className='command-description block'>
                                        {item.path}
                                    </span>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
            </CommandList>
        </CommandDialog>
    )
}
