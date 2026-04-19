import { describe, expect, test } from 'bun:test'
import {
    type PadWorkspaceViewState,
    createPadWorkspaceViewState,
    reducePadWorkspaceViewState,
} from '@/pad-workspace/domain/workspace-view-state'

describe('workspace view state', () => {
    test('starts with editor layout and sidebar closed', () => {
        const state = createPadWorkspaceViewState()

        expect(state.layout).toBe('editor')
        expect(state.sidebarOpen).toBe(false)
    })

    test('toggles dialogs and keeps the last requested one', () => {
        const state: PadWorkspaceViewState = {
            activeTab: 'text',
            cursor: { line: 1, column: 1 },
            dialog: null,
            drawingThemePreference: 'app',
            layout: 'split',
            sidebarOpen: true,
        }

        const commandOpen = reducePadWorkspaceViewState(state, {
            kind: 'dialog-toggled',
            dialog: 'command',
        })
        const treeOpen = reducePadWorkspaceViewState(commandOpen, {
            kind: 'dialog-toggled',
            dialog: 'tree',
        })
        const treeClosed = reducePadWorkspaceViewState(treeOpen, {
            kind: 'dialog-toggled',
            dialog: 'tree',
        })

        expect(commandOpen.dialog).toBe('command')
        expect(treeOpen.dialog).toBe('tree')
        expect(treeClosed.dialog).toBeNull()
    })

    test('sets tab, layout, cursor, and sidebar state directly', () => {
        const state: PadWorkspaceViewState = {
            activeTab: 'text',
            cursor: { line: 1, column: 1 },
            dialog: null,
            drawingThemePreference: 'app',
            layout: 'split',
            sidebarOpen: true,
        }

        const next = reducePadWorkspaceViewState(
            reducePadWorkspaceViewState(
                reducePadWorkspaceViewState(
                    reducePadWorkspaceViewState(state, {
                        kind: 'tab-opened',
                        tab: 'drawing',
                    }),
                    { kind: 'layout-set', layout: 'preview' },
                ),
                { kind: 'cursor-set', cursor: { line: 8, column: 3 } },
            ),
            { kind: 'sidebar-toggled' },
        )

        expect(next.activeTab).toBe('drawing')
        expect(next.layout).toBe('preview')
        expect(next.cursor).toEqual({ line: 8, column: 3 })
        expect(next.sidebarOpen).toBe(false)
    })
})
