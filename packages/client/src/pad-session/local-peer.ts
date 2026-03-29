import type { LocalPeer } from './pad-room-types'

const LOCAL_PEER_STORAGE_KEY = 'mmpad.peer'

const PEER_PALETTE = [
    { background: '#f97316', stroke: '#7c2d12', text: '#ea580c', textLight: '#fdba7433' },
    { background: '#0ea5e9', stroke: '#164e63', text: '#0284c7', textLight: '#7dd3fc33' },
    { background: '#22c55e', stroke: '#14532d', text: '#16a34a', textLight: '#86efac33' },
    { background: '#e11d48', stroke: '#881337', text: '#e11d48', textLight: '#fb718533' },
    { background: '#a855f7', stroke: '#581c87', text: '#9333ea', textLight: '#d8b4fe33' },
] as const

export const ANIME_PEER_NAMES = [
    'Goku',
    'Naruto Uzumaki',
    'Monkey D. Luffy',
    'Satoru Gojo',
    'Levi Ackerman',
    'Eren Yeager',
    'Mikasa Ackerman',
    'Edward Elric',
    'Spike Spiegel',
    'Sailor Moon',
    'Light Yagami',
    'Lelouch Lamperouge',
    'Tanjiro Kamado',
    'Nezuko Kamado',
    'Kakashi Hatake',
    'Ichigo Kurosaki',
    'Roronoa Zoro',
    'Vegeta',
    'Killua Zoldyck',
    'Gon Freecss',
    'Saitama',
    'Genos',
    'Yuji Itadori',
    'Megumi Fushiguro',
    'Nobara Kugisaki',
    'Asuna Yuuki',
    'Kirito',
    'Anya Forger',
    'Frieren',
    'Violet Evergarden',
] as const

const animePeerNames = new Set<string>(ANIME_PEER_NAMES)
const E2E_PEER = createPeer('Goku', PEER_PALETTE[4])

export function loadLocalPeer(): LocalPeer {
    if (import.meta.env.VITE_E2E === '1') {
        const peer = readStoredLocalPeer(window.localStorage.getItem(LOCAL_PEER_STORAGE_KEY)) ?? E2E_PEER
        window.localStorage.setItem(LOCAL_PEER_STORAGE_KEY, JSON.stringify(peer))
        return peer
    }

    const stored = readStoredLocalPeer(window.localStorage.getItem(LOCAL_PEER_STORAGE_KEY))
    if (stored) return stored

    const peer = createRandomLocalPeer()
    window.localStorage.setItem(LOCAL_PEER_STORAGE_KEY, JSON.stringify(peer))
    return peer
}

export function createRandomLocalPeer(random = Math.random): LocalPeer {
    return createPeer(
        pickRandom(ANIME_PEER_NAMES, random),
        pickRandom(PEER_PALETTE, random),
    )
}

export function readStoredLocalPeer(value: string | null): LocalPeer | null {
    if (!value) return null

    try {
        return readLocalPeer(JSON.parse(value))
    } catch {
        return null
    }
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

function readLocalPeer(value: unknown): LocalPeer | null {
    if (!isRecord(value)) return null
    if (typeof value.name !== 'string') return null
    if (!animePeerNames.has(value.name)) return null
    if (!isRecord(value.color)) return null
    if (typeof value.color.background !== 'string') return null
    if (typeof value.color.stroke !== 'string') return null
    if (typeof value.textColor !== 'string') return null
    if (typeof value.textColorLight !== 'string') return null

    return {
        name: value.name,
        color: {
            background: value.color.background,
            stroke: value.color.stroke,
        },
        textColor: value.textColor,
        textColorLight: value.textColorLight,
    }
}

function pickRandom<T>(values: readonly T[], random: () => number): T {
    return values[Math.floor(random() * values.length)]!
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}
