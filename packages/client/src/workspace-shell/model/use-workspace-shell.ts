import type { PadPath } from '@mmpad/shared'
import { padPathName } from '@mmpad/shared'
import { useEffect, useState } from 'react'
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
import type { DialogName } from '@/shell/dialog-name'

export type PadWorkspaceLayout = 'split' | 'editor' | 'preview'
export type PadWorkspaceTab = 'text' | 'diffs' | 'drawing' | 'files'
export type PadWorkspaceDirection = 'horizontal' | 'vertical'

export type WorkspaceShellState = {
    activeTab: PadWorkspaceTab
    clockLabel: string
    cursorLabel: string
    dialog: DialogName
    drawingTheme: DrawingTheme
    drawingThemePreference: DrawingThemePreference
    layout: PadWorkspaceLayout
    padName: string
    path: PadPath
    phrase: string
    sidebarOpen: boolean
    splitDirection: PadWorkspaceDirection
}

export type WorkspaceShellActions = {
    closeDialog: () => void
    openDialog: (dialog: Exclude<DialogName, null>) => void
    openTab: (tab: PadWorkspaceTab) => void
    setCursor: (cursor: CursorPosition) => void
    setDrawingThemePreference: (preference: DrawingThemePreference) => void
    setLayout: (layout: PadWorkspaceLayout) => void
    toggleDialog: (dialog: Exclude<DialogName, null>) => void
    toggleSidebar: () => void
}

export function useWorkspaceShell(path: PadPath) {
    const { resolvedTheme } = useTheme()
    const [activeTab, setActiveTab] = useState<PadWorkspaceTab>('text')
    const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 })
    const [dialog, setDialog] = useState<DialogName>(null)
    const [drawingThemePreference, setDrawingThemePreference] = useState<DrawingThemePreference>(readDrawingThemePreference)
    const [layout, setLayout] = useState<PadWorkspaceLayout>('split')
    const [phrase] = useState(getRandomPhrase)
    const [sidebarOpen, setSidebarOpen] = useState(readSidebarDefault)
    const clockLabel = useClockLabel()
    const splitDirection = useWorkspaceDirection()
    const drawingTheme = resolveDrawingThemePreference(drawingThemePreference, resolvedTheme)

    useEffect(() => {
        document.title = 'Mpad'
    }, [])

    useEffect(() => {
        writeDrawingThemePreference(drawingThemePreference)
    }, [drawingThemePreference])

    useEffect(() => {
        const unsubs = [
            onCtrlKeyPressed(',', () => setDialog((value) => value === 'command' ? null : 'command')),
            onCtrlKeyPressed('.', () => setDialog((value) => value === 'tree' ? null : 'tree')),
            onCtrlKeyPressed(';', () => setDialog((value) => value === 'files' ? null : 'files')),
            onCtrlKeyPressed('b', () => setSidebarOpen((value) => !value)),
        ]

        return () => {
            for (const unsubscribe of unsubs) unsubscribe()
        }
    }, [])

    const state: WorkspaceShellState = {
        activeTab,
        clockLabel,
        cursorLabel: `Ln ${cursor.line}, Col ${cursor.column}`,
        dialog,
        drawingTheme,
        drawingThemePreference,
        layout,
        padName: padPathName(path),
        path,
        phrase,
        sidebarOpen,
        splitDirection,
    }

    const actions: WorkspaceShellActions = {
        closeDialog() {
            setDialog(null)
        },
        openDialog(nextDialog) {
            setDialog(nextDialog)
        },
        openTab(tab) {
            setActiveTab(tab)
        },
        setCursor(nextCursor) {
            setCursor(nextCursor)
        },
        setDrawingThemePreference(preference) {
            setDrawingThemePreference(preference)
        },
        setLayout(nextLayout) {
            setLayout(nextLayout)
        },
        toggleDialog(nextDialog) {
            setDialog((value) => value === nextDialog ? null : nextDialog)
        },
        toggleSidebar() {
            setSidebarOpen((value) => !value)
        },
    }

    return { state, actions }
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

function readSidebarDefault() {
    return window.innerWidth > 640
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
