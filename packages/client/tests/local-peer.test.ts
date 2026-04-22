import { describe, expect, test } from 'bun:test'
import {
    PEER_NAMES,
    createRandomLocalPeer,
    readStoredLocalPeer,
} from '@/pad-workspace/infrastructure/browser-local-peer-store'

describe('local peer', () => {
    test('picks an adjective animal name and palette color for new peers', () => {
        const peer = createRandomLocalPeer(() => 0)

        expect(peer.id.startsWith('peer-')).toBe(true)
        expect(peer.name).toBe(PEER_NAMES[0])
        expect(peer.color.background).toBe('#f97316')
        expect(peer.color.stroke).toBe('#7c2d12')
        expect(peer.textColor).toBe('#ea580c')
        expect(peer.textColorLight).toBe('#fdba7433')
    })

    test('rejects stored peers with invalid shape', () => {
        const stored = JSON.stringify({
            name: 'peer-abcd',
            color: { background: '#f97316', stroke: '#7c2d12' },
            textColor: '#ea580c',
            textColorLight: '#fdba7433',
        })

        expect(readStoredLocalPeer(stored)).toBeNull()
    })

    test('ignores malformed stored peers', () => {
        expect(readStoredLocalPeer('{')).toBeNull()
    })

    test('keeps stored adjective animal peers', () => {
        const stored = JSON.stringify({
            name: 'Bright Fox',
            color: { background: '#0ea5e9', stroke: '#164e63' },
            textColor: '#0284c7',
            textColorLight: '#7dd3fc33',
        })

        const peer = readStoredLocalPeer(stored)

        expect(peer).toEqual({
            id: expect.stringMatching(/^peer-/),
            name: 'Bright Fox',
            color: { background: '#0ea5e9', stroke: '#164e63' },
            textColor: '#0284c7',
            textColorLight: '#7dd3fc33',
        })
        expect(peer?.id.startsWith('peer-')).toBe(true)
    })
})
