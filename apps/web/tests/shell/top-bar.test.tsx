import { describe, expect, test } from 'bun:test'
import type { TextEditorHandle } from '@/features/text'
import type { PadWorkspaceShellModel } from '@/features/workspace/application/controller'
import { PadTopBar } from '@/features/workspace/view/top-bar'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

describe('pad top bar', () => {
    test('shows the PDF export action for ready text pads', () => {
        const html = renderToStaticMarkup(
            createElement(PadTopBar, {
                shell: createShellModel(),
                textEditor: createTextEditor(),
            }),
        )

        expect(html).toContain('aria-label="Export PDF"')
        expect(html).toContain('title="Export PDF"')
    })
})

function createShellModel(): PadWorkspaceShellModel {
    return {
        view: {
            activeTab: 'text',
            clockLabel: '03/29/26, 6:18 PM',
            cursor: { line: 1, column: 1 },
            cursorLabel: 'Ln 1, Col 1',
            dialog: null,
            drawingTheme: 'light',
            drawingThemePreference: 'app',
            layout: 'split',
            padName: 'test',
            path: '/test',
            phrase: 'Opening',
            sidebarOpen: true,
            splitDirection: 'horizontal',
        },
        status: {
            connection: 'connected',
            connectionError: null,
            peerCount: 1,
        },
        commands: {
            closeDialog() {},
            navigateToPad() {},
            openDialog() {},
            openTab() {},
            setCursor() {},
            setDrawingThemePreference() {},
            setLayout() {},
            toggleDialog() {},
            toggleSidebar() {},
        },
    }
}

function createTextEditor(): TextEditorHandle {
    return {
        appendText() {},
        mount() {
            return () => {}
        },
        readContent() {
            return '# Test'
        },
        setText() {},
        subscribe() {
            return () => {}
        },
    }
}
