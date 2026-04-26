import { DrawingSettingsDialog } from '@/features/drawing'
import { FilesDialog } from '@/features/files'
import { TreeDialog, type WorkspaceNavigationModel } from '@/features/tree'
import type {
    PadWorkspaceFilesModel,
    PadWorkspaceShellModel,
} from '@/features/workspace/application/controller'
import { CommandMenu } from '@/features/workspace/view/command-menu'

export function WorkspaceDialogs(input: {
    shell: PadWorkspaceShellModel
    navigation: WorkspaceNavigationModel
    files: PadWorkspaceFilesModel
}) {
    const { commands, view } = input.shell
    const tree = input.navigation.kind === 'ready' ? input.navigation.items : []
    const treeError =
        input.navigation.kind === 'error' ? input.navigation.message : null

    return (
        <>
            <CommandMenu
                open={view.dialog === 'command'}
                onOpenChange={(open) =>
                    open
                        ? commands.openDialog('command')
                        : commands.closeDialog()
                }
                commands={commands}
            />
            <TreeDialog
                open={view.dialog === 'tree'}
                onOpenChange={(open) =>
                    open ? commands.openDialog('tree') : commands.closeDialog()
                }
                errorMessage={treeError}
                path={view.path}
                tree={tree}
                onSelect={commands.navigateToPad}
            />
            <FilesDialog
                open={view.dialog === 'files'}
                onOpenChange={(open) =>
                    open ? commands.openDialog('files') : commands.closeDialog()
                }
                path={view.path}
                files={input.files.files}
                onDelete={input.files.deleteFile}
                onDownload={input.files.downloadFile}
            />
            <DrawingSettingsDialog
                open={view.dialog === 'drawing-settings'}
                onOpenChange={(open) =>
                    open
                        ? commands.openDialog('drawing-settings')
                        : commands.closeDialog()
                }
                preference={view.drawingThemePreference}
                onPreferenceChange={commands.setDrawingThemePreference}
            />
        </>
    )
}
