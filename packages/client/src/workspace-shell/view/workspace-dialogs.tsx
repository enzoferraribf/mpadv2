import type { PadPageModel } from '@/app/model/use-pad-page'
import { CommandMenu } from '@/workspace/command-menu'
import { DrawingSettingsDialog } from '@/pad-drawing/drawing-settings-dialog'
import { TreeDialog } from '@/pad-tree/tree-dialog'
import { FilesDialog } from '@/live-files/view/files-dialog'

export function WorkspaceDialogs(input: { model: PadPageModel }) {
    const { actions, state } = input.model

    return (
        <>
            <CommandMenu
                open={state.view.dialog === 'command'}
                onOpenChange={(open) => open ? actions.openDialog('command') : actions.closeDialog()}
                actions={actions}
            />
            <TreeDialog
                open={state.view.dialog === 'tree'}
                onOpenChange={(open) => open ? actions.openDialog('tree') : actions.closeDialog()}
                path={state.view.path}
                tree={state.status.tree}
                onSelect={actions.navigateToPad}
            />
            <FilesDialog
                open={state.view.dialog === 'files'}
                onOpenChange={(open) => open ? actions.openDialog('files') : actions.closeDialog()}
                path={state.view.path}
                files={state.status.files}
                onDelete={actions.deleteFile}
                onDownload={actions.downloadFile}
            />
            <DrawingSettingsDialog
                open={state.view.dialog === 'drawing-settings'}
                onOpenChange={(open) => open ? actions.openDialog('drawing-settings') : actions.closeDialog()}
                preference={state.view.drawingThemePreference}
                onPreferenceChange={actions.setDrawingThemePreference}
            />
        </>
    )
}
