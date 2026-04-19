import type {
    PadWorkspaceFilesModel,
    PadWorkspaceShellModel,
} from '@/pad-workspace/application/use-pad-workspace-model'
import type { WorkspaceNavigationModel } from '@/pad-workspace/application/use-workspace-navigation'
import { CommandMenu } from '@/workspace/command-menu'
import { DrawingSettingsDialog } from '@/pad-drawing/drawing-settings-dialog'
import { TreeDialog } from '@/pad-tree/tree-dialog'
import { FilesDialog } from '@/live-files/view/files-dialog'

export function WorkspaceDialogs(input: {
    shell: PadWorkspaceShellModel
    navigation: WorkspaceNavigationModel
    files: PadWorkspaceFilesModel
}) {
    const { commands, view } = input.shell
    const tree = input.navigation.kind === 'ready' ? input.navigation.items : []
    const treeError = input.navigation.kind === 'error' ? input.navigation.message : null

    return (
        <>
            <CommandMenu
                open={view.dialog === 'command'}
                onOpenChange={(open) => open ? commands.openDialog('command') : commands.closeDialog()}
                commands={commands}
            />
            <TreeDialog
                open={view.dialog === 'tree'}
                onOpenChange={(open) => open ? commands.openDialog('tree') : commands.closeDialog()}
                errorMessage={treeError}
                path={view.path}
                tree={tree}
                onSelect={commands.navigateToPad}
            />
            <FilesDialog
                open={view.dialog === 'files'}
                onOpenChange={(open) => open ? commands.openDialog('files') : commands.closeDialog()}
                path={view.path}
                files={input.files.files}
                onDelete={input.files.deleteFile}
                onDownload={input.files.downloadFile}
            />
            <DrawingSettingsDialog
                open={view.dialog === 'drawing-settings'}
                onOpenChange={(open) => open ? commands.openDialog('drawing-settings') : commands.closeDialog()}
                preference={view.drawingThemePreference}
                onPreferenceChange={commands.setDrawingThemePreference}
            />
        </>
    )
}
