import {
    padPathName,
    type PadPath,
    type PadWorkspaceDialog,
    type PadWorkspaceDirection,
    type PadWorkspaceLayout,
    type PadWorkspaceTab,
} from '@mmpad/shared'
import { useEffect, useReducer, useState } from 'react'
import { useTheme } from 'next-themes'
import { getRandomPhrase } from '@/components/feedback/loading-phrases'
import { onCtrlKeyPressed } from '@/lib/events'
import {
    readDrawingThemePreference,
    resolveDrawingThemePreference,
    writeDrawingThemePreference,
    type DrawingTheme,
    type DrawingThemePreference,
} from '@/pad-drawing/drawing-theme'
import type { CursorPosition } from '@/pad-text/infrastructure/text-editor'
import {
    createPadWorkspaceViewState,
    reducePadWorkspaceViewState,
    type PadWorkspaceViewState as PadWorkspaceViewStateCore,
} from '@/pad-workspace/domain/workspace-view-state'

export type PadWorkspaceViewState = PadWorkspaceViewStateCore & {
    clockLabel: string
    cursorLabel: string
    drawingTheme: DrawingTheme
    padName: string
    path: PadPath
    phrase: string
    splitDirection: PadWorkspaceDirection
}

export type PadWorkspaceViewCommands = {
    closeDialog: () => void
    openDialog: (dialog: Exclude<PadWorkspaceDialog, null>) => void
    openTab: (tab: PadWorkspaceTab) => void
    setCursor: (cursor: CursorPosition) => void
    setDrawingThemePreference: (preference: DrawingThemePreference) => void
    setLayout: (layout: PadWorkspaceLayout) => void
    toggleDialog: (dialog: Exclude<PadWorkspaceDialog, null>) => void
    toggleSidebar: () => void
}

export function usePadWorkspaceView(path: PadPath) {
    const { resolvedTheme } = useTheme()
    const [state, dispatch] = useReducer(
        reducePadWorkspaceViewState,
        readDrawingThemePreference(),
        createPadWorkspaceViewState,
    )
    const [phrase] = useState(getRandomPhrase)
    const clockLabel = useClockLabel()
    const splitDirection = useWorkspaceDirection()

    useEffect(() => {
        document.title = 'Mpad'
    }, [])

    useEffect(() => {
        writeDrawingThemePreference(state.drawingThemePreference)
    }, [state.drawingThemePreference])

    useEffect(() => {
        const unsubs = [
            onCtrlKeyPressed(',', () => dispatch({ kind: 'dialog-toggled', dialog: 'command' })),
            onCtrlKeyPressed('.', () => dispatch({ kind: 'dialog-toggled', dialog: 'tree' })),
            onCtrlKeyPressed(';', () => dispatch({ kind: 'dialog-toggled', dialog: 'files' })),
            onCtrlKeyPressed('b', () => dispatch({ kind: 'sidebar-toggled' })),
        ]

        return () => {
            for (const unsubscribe of unsubs) unsubscribe()
        }
    }, [])

    const viewState: PadWorkspaceViewState = {
        ...state,
        clockLabel,
        cursorLabel: `Ln ${state.cursor.line}, Col ${state.cursor.column}`,
        drawingTheme: resolveDrawingThemePreference(state.drawingThemePreference, resolvedTheme),
        padName: padPathName(path),
        path,
        phrase,
        splitDirection,
    }

    const commands: PadWorkspaceViewCommands = {
        closeDialog() {
            dispatch({ kind: 'dialog-closed' })
        },
        openDialog(dialog) {
            dispatch({ kind: 'dialog-opened', dialog })
        },
        openTab(tab) {
            dispatch({ kind: 'tab-opened', tab })
        },
        setCursor(cursor) {
            dispatch({ kind: 'cursor-set', cursor })
        },
        setDrawingThemePreference(preference) {
            dispatch({ kind: 'drawing-theme-preference-set', preference })
        },
        setLayout(layout) {
            dispatch({ kind: 'layout-set', layout })
        },
        toggleDialog(dialog) {
            dispatch({ kind: 'dialog-toggled', dialog })
        },
        toggleSidebar() {
            dispatch({ kind: 'sidebar-toggled' })
        },
    }

    return { state: viewState, commands }
}

function useWorkspaceDirection(): PadWorkspaceDirection {
    const [direction, setDirection] = useState<PadWorkspaceDirection>(readWorkspaceDirection)

    useEffect(() => {
        const onResize = () => setDirection(readWorkspaceDirection())
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    return direction
}

function readWorkspaceDirection(): PadWorkspaceDirection {
    return window.innerWidth >= 1024 ? 'horizontal' : 'vertical'
}

function useClockLabel() {
    const [label, setLabel] = useState(readClockLabel)

    useEffect(() => {
        if (import.meta.env.VITE_E2E === '1') return

        const id = window.setInterval(() => setLabel(readClockLabel()), 30_000)
        return () => window.clearInterval(id)
    }, [])

    return label
}

function readClockLabel() {
    if (import.meta.env.VITE_E2E === '1') return '03/29/26, 6:18 PM'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date())
}
