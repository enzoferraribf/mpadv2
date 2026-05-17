import { PadStatusBar } from '@/features/workspace/view/status-bar'
import { OpeningLoader } from '@/shared/ui/feedback/opening-loader'
import { TextLoadingSkeleton } from '@/shared/ui/feedback/text-loading-skeleton'
import type { PadPath } from '@mpad/core/pad-path'

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
                    </div>
                </div>
            </div>
            <div className='app-content'>
                <div className='app-main'>
                    <section className='loading-shell workspace-shell'>
                        <OpeningLoader
                            label={
                                input.path.split('/').filter(Boolean).at(-1) ??
                                'pad'
                            }
                        />
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

export function DrawingWorkspaceFallback() {
    return (
        <section
            className='loading-shell workspace-shell min-h-0'
            data-testid='drawing-workspace'
        >
            <OpeningLoader label='Excalidraw' />
        </section>
    )
}

export function TextWorkspaceFallback() {
    return (
        <section className='workspace-shell min-h-0'>
            <TextLoadingSkeleton />
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
