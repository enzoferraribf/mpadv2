import type { PadPath } from '@mpad/core/pad-path'

export function PadStatusBar(input: {
    path: PadPath
    connection: 'connecting' | 'connected' | 'disconnected'
    peerCount: number
    clockLabel: string
    cursorLabel: string
}) {
    return (
        <footer className='pad-statusbar'>
            <span className='pad-statusbar-segment'>
                {input.path.split('/').filter(Boolean).join(' / ')}
            </span>
            <span className='pad-statusbar-segment pad-statusbar-conn'>
                <span className={`pad-statusbar-dot ${input.connection}`} />
                {input.peerCount} peer{input.peerCount !== 1 ? 's' : ''}
            </span>
            <span className='pad-statusbar-segment' data-testid='status-cursor'>
                {input.cursorLabel}
            </span>
            <span className='pad-statusbar-segment' data-testid='status-clock'>
                {input.clockLabel}
            </span>
        </footer>
    )
}
