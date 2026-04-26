import { PadStatusBar } from '@/features/workspace/view/status-bar'
import type { PadPath } from '@mpad/core/pad-path'

const filesFallbackItems = Array.from(
    { length: 10 },
    (_, index) => `file-skeleton-${index}`,
)
const textFallbackLines = Array.from(
    { length: 12 },
    (_, index) => `text-line-${index}`,
)
const drawingFallbackTools = Array.from(
    { length: 7 },
    (_, index) => `drawing-tool-${index}`,
)

export function PadRouteFallback(input: { path: PadPath }) {
    return (
        <main className='app-shell' data-testid='pad-page'>
            <div className='app-topbar'>
                <div className='app-topbar-left'>
                    <div className='lazy-icon-skeleton' />
                </div>
                <div className='app-topbar-center'>
                    <span className='mpad-logo'>
                        <span className='mpad-logo-m'>M</span>PAD
                    </span>
                </div>
                <div className='app-topbar-right'>
                    <div className='pad-tabs'>
                        <div className='lazy-tab-skeleton wide' />
                        <div className='lazy-tab-skeleton' />
                        <div className='lazy-tab-skeleton' />
                    </div>
                </div>
            </div>
            <div className='app-content'>
                <div className='app-main'>
                    <section className='loading-shell workspace-shell'>
                        <div className='route-loader'>
                            <span className='mpad-logo'>
                                Opening{' '}
                                {input.path.split('/').filter(Boolean).at(-1) ??
                                    'pad'}
                            </span>
                            <div className='route-loader-bar'>
                                <span />
                            </div>
                        </div>
                    </section>
                    <PadStatusBar
                        path={input.path}
                        connection='connecting'
                        peerCount={0}
                        clockLabel=''
                        cursorLabel='Ln 1, Col 1'
                    />
                </div>
            </div>
        </main>
    )
}

export function FilesPaneFallback() {
    return (
        <section className='workspace-shell min-h-0'>
            <div className='files-pane'>
                <div className='files-grid'>
                    {filesFallbackItems.map((item) => (
                        <div
                            className='files-card files-card-skeleton'
                            key={item}
                        >
                            <div className='files-card-icon' />
                            <div className='lazy-line short' />
                            <div className='lazy-line tiny' />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export function DrawingWorkspaceFallback() {
    return (
        <section
            className='workspace-shell min-h-0'
            data-testid='drawing-workspace'
        >
            <DrawingCanvasFallback />
        </section>
    )
}

export function TextWorkspaceFallback() {
    return (
        <section className='workspace-shell min-h-0'>
            <div className='text-loader-grid'>
                <div className='text-loader-pane'>
                    {textFallbackLines.map((line, index) => (
                        <div
                            className={`lazy-line ${index % 3 === 0 ? 'wide' : ''}`}
                            key={line}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}

export function DialogFallback() {
    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/84 backdrop-blur-sm'>
            <div className='dialog-panel dialog-loader'>
                <div className='lazy-line wide' />
                <div className='lazy-line' />
                <div className='lazy-command-row' />
                <div className='lazy-command-row' />
                <div className='lazy-command-row' />
            </div>
        </div>
    )
}

function DrawingCanvasFallback() {
    return (
        <div className='drawing-loader'>
            <div className='drawing-loader-toolbar'>
                {drawingFallbackTools.map((tool) => (
                    <span key={tool} />
                ))}
            </div>
            <div className='drawing-loader-shape one' />
            <div className='drawing-loader-shape two' />
            <div className='drawing-loader-line' />
        </div>
    )
}
