import type { PadWorkspaceShellCommands } from '@/features/workspace/application/controller'
import type { PadWorkspaceLayout } from '@/features/workspace/domain/model'
import {
    CommandDialog,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/shared/ui/command'
import {
    Blocks,
    Columns2,
    Eye,
    FileText,
    FolderTree,
    PanelRightOpen,
} from 'lucide-react'

export function CommandMenu(input: {
    open: boolean
    onOpenChange: (open: boolean) => void
    commands: PadWorkspaceShellCommands
}) {
    return (
        <CommandDialog open={input.open} onOpenChange={input.onOpenChange}>
            <CommandInput placeholder='Search commands' />
            <CommandList>
                <CommandGroup heading='Workspace'>
                    <CommandItem
                        onSelect={() =>
                            run(input, () => input.commands.openTab('drawing'))
                        }
                        className='gap-3'
                    >
                        <span className='command-icon-wrap'>
                            <Blocks className='h-4 w-4' />
                        </span>
                        <CommandCopy
                            heading='Excalidraw'
                            description='Show the shared drawing.'
                        />
                    </CommandItem>
                    <CommandItem
                        onSelect={() =>
                            run(input, () => input.commands.openDialog('tree'))
                        }
                        className='gap-3'
                    >
                        <span className='command-icon-wrap'>
                            <FolderTree className='h-4 w-4' />
                        </span>
                        <CommandCopy
                            heading='Explorer'
                            description='Browse related pads.'
                        />
                    </CommandItem>
                    <CommandItem
                        onSelect={() =>
                            run(input, () => input.commands.openDialog('files'))
                        }
                        className='gap-3'
                    >
                        <span className='command-icon-wrap'>
                            <FileText className='h-4 w-4' />
                        </span>
                        <CommandCopy
                            heading='Files'
                            description='Browse live files.'
                        />
                    </CommandItem>
                </CommandGroup>
                <CommandGroup heading='Layout'>
                    <CommandItem
                        onSelect={() => setLayout(input, 'split')}
                        className='gap-3'
                    >
                        <span className='command-icon-wrap'>
                            <Columns2 className='h-4 w-4' />
                        </span>
                        <CommandCopy
                            heading='Split'
                            description='Show editor and preview together.'
                        />
                    </CommandItem>
                    <CommandItem
                        onSelect={() => setLayout(input, 'editor')}
                        className='gap-3'
                    >
                        <span className='command-icon-wrap'>
                            <PanelRightOpen className='h-4 w-4' />
                        </span>
                        <CommandCopy
                            heading='Editor'
                            description='Focus the editor.'
                        />
                    </CommandItem>
                    <CommandItem
                        onSelect={() => setLayout(input, 'preview')}
                        className='gap-3'
                    >
                        <span className='command-icon-wrap'>
                            <Eye className='h-4 w-4' />
                        </span>
                        <CommandCopy
                            heading='Preview'
                            description='Focus the preview.'
                        />
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}

function setLayout(
    input: {
        commands: PadWorkspaceShellCommands
        onOpenChange: (open: boolean) => void
    },
    layout: PadWorkspaceLayout,
) {
    input.commands.closeDialog()
    input.commands.setLayout(layout)
}

function run(
    input: {
        commands: PadWorkspaceShellCommands
        onOpenChange: (open: boolean) => void
    },
    action: () => void,
) {
    input.commands.closeDialog()
    action()
}

function CommandCopy(input: { heading: string; description: string }) {
    return (
        <div className='min-w-0 space-y-1 py-2'>
            <span className='command-heading'>{input.heading}</span>
            <span className='command-description block'>
                {input.description}
            </span>
        </div>
    )
}
