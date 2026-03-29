import type { LiveFileState, PadPath, PadTreeItem } from '@mmpad/shared'
import { padPathName } from '@mmpad/shared'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import type { DialogName } from '@/shell/dialog-name'
import { onCtrlKeyPressed } from '@/lib/events'
import { getRandomPhrase } from '@/components/feedback/loading-phrases'
import { loadLocalPeer } from '@/pad-session/local-peer'
import type { PadConnection } from '@/pad-session/pad-room-types'
import { usePadDrawingRoom, type PadDrawingState } from '@/pad-session/use-pad-drawing-room'
import { usePadTextRoom } from '@/pad-session/use-pad-text-room'
import { usePadTree } from '@/pad-tree/use-pad-tree'
import { usePadFiles } from '@/pad-files/use-pad-files'
import {
    readDrawingThemePreference,
    resolveDrawingThemePreference,
    writeDrawingThemePreference,
    type DrawingTheme,
    type DrawingThemePreference,
} from '@/pad-drawing/drawing-theme'
import type { CursorPosition, TextEditorHandle } from '@/pad-text/text-editor-handle'

export type PadWorkspaceLayout = 'split' | 'editor' | 'preview'
export type PadWorkspaceTab = 'text' | 'drawing' | 'files'
export type PadWorkspaceDirection = 'horizontal' | 'vertical'

type PadWorkspaceView = {
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

export type PadWorkspaceState =
    | {
        kind: 'loading'
        view: PadWorkspaceView
        status: {
            connection: 'connecting'
            peerCount: 0
            tree: PadTreeItem[]
            files: LiveFileState[]
        }
    }
    | {
        kind: 'ready'
        view: PadWorkspaceView
        status: {
            connection: PadConnection
            peerCount: number
            tree: PadTreeItem[]
            files: LiveFileState[]
        }
        text: {
            content: string
            editor: TextEditorHandle
        }
        drawing: PadDrawingState
    }

export type PadWorkspaceActions = {
    closeDialog: () => void
    deleteFile: (id: string) => void
    downloadFile: (file: LiveFileState) => void
    navigateToPad: (path: PadPath) => void
    openDialog: (dialog: Exclude<DialogName, null>) => void
    openTab: (tab: PadWorkspaceTab) => void
    setCursor: (cursor: CursorPosition) => void
    setDrawingThemePreference: (preference: DrawingThemePreference) => void
    setLayout: (layout: PadWorkspaceLayout) => void
    toggleDialog: (dialog: Exclude<DialogName, null>) => void
    toggleSidebar: () => void
    uploadFile: (file: File) => void
}

export type PadWorkspaceModel = {
    actions: PadWorkspaceActions
    state: PadWorkspaceState
}

export function usePadWorkspace(path: PadPath): PadWorkspaceModel {
    const { resolvedTheme } = useTheme()
    const navigate = useNavigate()
    const localPeer = useMemo(loadLocalPeer, [])
    const [activeTab, setActiveTab] = useState<PadWorkspaceTab>('text')
    const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 })
    const [dialog, setDialog] = useState<DialogName>(null)
    const [drawingThemePreference, setDrawingThemePreference] = useState<DrawingThemePreference>(readDrawingThemePreference)
    const [layout, setLayout] = useState<PadWorkspaceLayout>('split')
    const [phrase] = useState(getRandomPhrase)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const clockLabel = useClockLabel()
    const splitDirection = usePadWorkspaceDirection()
    const text = usePadTextRoom(path, localPeer)
    const drawing = usePadDrawingRoom(path, localPeer, activeTab === 'drawing')
    const tree = usePadTree(path)
    const files = usePadFiles(path, localPeer)
    const padName = padPathName(path)
    const drawingTheme = resolveDrawingThemePreference(drawingThemePreference, resolvedTheme)

    useEffect(() => {
        document.title = 'Mpad'
    }, [])

    useEffect(() => {
        writeDrawingThemePreference(drawingThemePreference)
    }, [drawingThemePreference])

    useEffect(() => {
        const unsubs = [
            onCtrlKeyPressed(',', () => setDialog((value) => (value === 'command' ? null : 'command'))),
            onCtrlKeyPressed('.', () => setDialog((value) => (value === 'tree' ? null : 'tree'))),
            onCtrlKeyPressed(';', () => setDialog((value) => (value === 'files' ? null : 'files'))),
            onCtrlKeyPressed('b', () => setSidebarOpen((value) => !value)),
        ]

        return () => {
            unsubs.forEach((unsubscribe) => unsubscribe())
        }
    }, [])

    const actions: PadWorkspaceActions = {
        closeDialog() {
            setDialog(null)
        },
        deleteFile(id) {
            files.deleteFile(id)
            toast.success('Local file removed')
        },
        downloadFile(file) {
            files.downloadFile(file)
        },
        navigateToPad(nextPath) {
            navigate({ to: '/$', params: { _splat: nextPath.slice(1) } })
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
            setDialog((value) => (value === nextDialog ? null : nextDialog))
        },
        toggleSidebar() {
            setSidebarOpen((value) => !value)
        },
        uploadFile(file) {
            try {
                files.uploadFile(file)
            } catch (error) {
                toast.error((error as Error).message)
            }
        },
    }

    const view: PadWorkspaceView = {
        activeTab,
        clockLabel,
        cursorLabel: formatCursorLabel(cursor),
        dialog,
        drawingTheme,
        drawingThemePreference,
        layout,
        padName,
        path,
        phrase,
        sidebarOpen,
        splitDirection,
    }

    if (!text || tree === null) {
        return {
            actions,
            state: {
                kind: 'loading',
                view,
                status: {
                    connection: 'connecting',
                    peerCount: 0,
                    tree: [],
                    files: [],
                },
            },
        }
    }

    return {
        actions,
        state: {
            kind: 'ready',
            view,
            status: {
                connection: text.connection,
                peerCount: text.peerCount,
                tree,
                files: files.files,
            },
            text: {
                content: text.textContent,
                editor: text.editor,
            },
            drawing,
        },
    }
}

function usePadWorkspaceDirection(): PadWorkspaceDirection {
    const [direction, setDirection] = useState<PadWorkspaceDirection>(readPadWorkspaceDirection)

    useEffect(() => {
        const onResize = () => setDirection(readPadWorkspaceDirection())
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    return direction
}

function readPadWorkspaceDirection(): PadWorkspaceDirection {
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

function formatCursorLabel(cursor: CursorPosition) {
    return `Ln ${cursor.line}, Col ${cursor.column}`
}
