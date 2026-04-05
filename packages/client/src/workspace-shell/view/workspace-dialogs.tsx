import type { PadWorkspaceModel } from '@/pad-workspace/application/use-pad-workspace-model'
import { CommandMenu } from '@/workspace/command-menu'
import { DrawingSettingsDialog } from '@/pad-drawing/drawing-settings-dialog'
import { TreeDialog } from '@/pad-tree/tree-dialog'
import { FilesDialog } from '@/live-files/view/files-dialog'

export function WorkspaceDialogs(input: { model: PadWorkspaceModel }) {
    const { commands, state } = input.model

    return (
        <>
            <CommandMenu
                open={state.view.dialog === 'command'}
                onOpenChange={(open) => open ? commands.openDialog('command') : commands.closeDialog()}
                commands={commands}
            />
            <TreeDialog
                open={state.view.dialog === 'tree'}
                onOpenChange={(open) => open ? commands.openDialog('tree') : commands.closeDialog()}
                path={state.view.path}
                tree={state.status.tree}
                onSelect={commands.navigateToPad}
            />
            <FilesDialog
                open={state.view.dialog === 'files'}
                onOpenChange={(open) => open ? commands.openDialog('files') : commands.closeDialog()}
                path={state.view.path}
                files={state.status.files}
                onDelete={commands.deleteFile}
                onDownload={commands.downloadFile}
            />
            <DrawingSettingsDialog
                open={state.view.dialog === 'drawing-settings'}
                onOpenChange={(open) => open ? commands.openDialog('drawing-settings') : commands.closeDialog()}
                preference={state.view.drawingThemePreference}
                onPreferenceChange={commands.setDrawingThemePreference}
            />
        </>
    )
}
