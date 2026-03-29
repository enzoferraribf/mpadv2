import type { LocalPeer } from './pad-room-types'

export function loadLocalPeer(): LocalPeer {
    const stored = window.localStorage.getItem('mmpad.peer')
    if (stored) return JSON.parse(stored) as LocalPeer

    const palette = [
        { background: '#f97316', stroke: '#7c2d12', text: '#ea580c', textLight: '#fdba7433' },
        { background: '#0ea5e9', stroke: '#164e63', text: '#0284c7', textLight: '#7dd3fc33' },
        { background: '#22c55e', stroke: '#14532d', text: '#16a34a', textLight: '#86efac33' },
        { background: '#e11d48', stroke: '#881337', text: '#e11d48', textLight: '#fb718533' },
        { background: '#a855f7', stroke: '#581c87', text: '#9333ea', textLight: '#d8b4fe33' },
    ]

    if (import.meta.env.VITE_E2E === '1') {
        const peer = createPeer('peer-e2e', palette[4]!)
        window.localStorage.setItem('mmpad.peer', JSON.stringify(peer))
        return peer
    }

    const color = palette[Math.floor(Math.random() * palette.length)]!
    const peer = createPeer(`peer-${crypto.randomUUID().slice(0, 4)}`, color)

    window.localStorage.setItem('mmpad.peer', JSON.stringify(peer))
    return peer
}

function createPeer(name: string, color: {
    background: string
    stroke: string
    text: string
    textLight: string
}): LocalPeer {
    return {
        name,
        color: {
            background: color.background,
            stroke: color.stroke,
        },
        textColor: color.text,
        textColorLight: color.textLight,
    }
}
