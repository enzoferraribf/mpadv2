import type { DrawingThemePreference } from '@/pad-drawing/drawing-theme'
import type { CursorPosition } from '@/pad-text/infrastructure/text-editor'
import type {
    PadWorkspaceDialog,
    PadWorkspaceLayout,
    PadWorkspaceTab,
} from '@/pad-workspace/domain/workspace-view'
import { assertNever } from '@mpad/core/assert'

export type PadWorkspaceViewState = {
    activeTab: PadWorkspaceTab
    cursor: CursorPosition
    dialog: PadWorkspaceDialog
    drawingThemePreference: DrawingThemePreference
    layout: PadWorkspaceLayout
    sidebarOpen: boolean
}

export type PadWorkspaceViewEvent =
    | { kind: 'tab-opened'; tab: PadWorkspaceTab }
    | { kind: 'cursor-set'; cursor: CursorPosition }
    | { kind: 'dialog-opened'; dialog: Exclude<PadWorkspaceDialog, null> }
    | { kind: 'dialog-closed' }
    | { kind: 'dialog-toggled'; dialog: Exclude<PadWorkspaceDialog, null> }
    | {
          kind: 'drawing-theme-preference-set'
          preference: DrawingThemePreference
      }
    | { kind: 'layout-set'; layout: PadWorkspaceLayout }
    | { kind: 'sidebar-toggled' }

export function createPadWorkspaceViewState(
    preference: DrawingThemePreference = 'app',
): PadWorkspaceViewState {
    return {
        activeTab: 'text',
        cursor: { line: 1, column: 1 },
        dialog: null,
        drawingThemePreference: preference,
        layout: 'editor',
        sidebarOpen: readSidebarDefault(),
    }
}

export function reducePadWorkspaceViewState(
    state: PadWorkspaceViewState,
    event: PadWorkspaceViewEvent,
): PadWorkspaceViewState {
    switch (event.kind) {
        case 'tab-opened':
            return { ...state, activeTab: event.tab }
        case 'cursor-set':
            return { ...state, cursor: event.cursor }
        case 'dialog-opened':
            return { ...state, dialog: event.dialog }
        case 'dialog-closed':
            return { ...state, dialog: null }
        case 'dialog-toggled':
            return {
                ...state,
                dialog: state.dialog === event.dialog ? null : event.dialog,
            }
        case 'drawing-theme-preference-set':
            return { ...state, drawingThemePreference: event.preference }
        case 'layout-set':
            return { ...state, layout: event.layout }
        case 'sidebar-toggled':
            return { ...state, sidebarOpen: !state.sidebarOpen }
    }

    return assertNever(event)
}

function readSidebarDefault() {
    return false
}
