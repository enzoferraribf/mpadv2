import { Blocks, Columns2, Eye, FileText, FolderTree, PanelRightOpen } from 'lucide-react'
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import type { PadPageActions, PadWorkspaceLayout } from '@/workspace-shell/model/use-pad-page-model'

export function CommandMenu(input: {
    open: boolean
    onOpenChange: (open: boolean) => void
    actions: PadPageActions
}) {
    return (
        <CommandDialog open={input.open} onOpenChange={input.onOpenChange}>
            <CommandInput placeholder="Search commands" />
            <CommandList>
                <CommandGroup heading="Workspace">
                    <CommandItem onSelect={() => run(input, () => input.actions.openTab('diffs'))} className="gap-3">
                        <span className="command-icon-wrap"><Columns2 className="h-4 w-4" /></span>
                        <CommandCopy heading="Diffs" description="Compare saved snapshots with the current text." />
                    </CommandItem>
                    <CommandItem onSelect={() => run(input, () => input.actions.openTab('drawing'))} className="gap-3">
                        <span className="command-icon-wrap"><Blocks className="h-4 w-4" /></span>
                        <CommandCopy heading="Excalidraw" description="Show the shared drawing." />
                    </CommandItem>
                    <CommandItem onSelect={() => run(input, () => input.actions.openDialog('tree'))} className="gap-3">
                        <span className="command-icon-wrap"><FolderTree className="h-4 w-4" /></span>
                        <CommandCopy heading="Explorer" description="Browse related pads." />
                    </CommandItem>
                    <CommandItem onSelect={() => run(input, () => input.actions.openDialog('files'))} className="gap-3">
                        <span className="command-icon-wrap"><FileText className="h-4 w-4" /></span>
                        <CommandCopy heading="Files" description="Browse live files." />
                    </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Layout">
                    <CommandItem onSelect={() => setLayout(input, 'split')} className="gap-3">
                        <span className="command-icon-wrap"><Columns2 className="h-4 w-4" /></span>
                        <CommandCopy heading="Split" description="Show editor and preview together." />
                    </CommandItem>
                    <CommandItem onSelect={() => setLayout(input, 'editor')} className="gap-3">
                        <span className="command-icon-wrap"><PanelRightOpen className="h-4 w-4" /></span>
                        <CommandCopy heading="Editor" description="Focus the editor." />
                    </CommandItem>
                    <CommandItem onSelect={() => setLayout(input, 'preview')} className="gap-3">
                        <span className="command-icon-wrap"><Eye className="h-4 w-4" /></span>
                        <CommandCopy heading="Preview" description="Focus the preview." />
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}

function setLayout(input: { actions: PadPageActions; onOpenChange: (open: boolean) => void }, layout: PadWorkspaceLayout) {
    input.actions.closeDialog()
    input.actions.setLayout(layout)
}

function run(input: { actions: PadPageActions; onOpenChange: (open: boolean) => void }, action: () => void) {
    input.actions.closeDialog()
    action()
}

function CommandCopy(input: { heading: string; description: string }) {
    return (
        <div className="min-w-0 space-y-1 py-2">
            <span className="command-heading">{input.heading}</span>
            <span className="command-description block">{input.description}</span>
        </div>
    )
}
