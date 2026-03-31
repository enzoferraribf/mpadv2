import { describe, expect, test } from 'bun:test'
import { ANIME_PEER_NAMES, createRandomLocalPeer, readStoredLocalPeer } from '../src/peer/model/local-peer'

describe('local peer', () => {
    test('picks an anime name and palette color for new peers', () => {
        const peer = createRandomLocalPeer(() => 0)

        expect(peer.name).toBe(ANIME_PEER_NAMES[0])
        expect(peer.color.background).toBe('#f97316')
        expect(peer.color.stroke).toBe('#7c2d12')
        expect(peer.textColor).toBe('#ea580c')
        expect(peer.textColorLight).toBe('#fdba7433')
    })

    test('migrates legacy stored peers', () => {
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

    test('keeps stored anime peers', () => {
        const stored = JSON.stringify({
            name: 'Naruto Uzumaki',
            color: { background: '#0ea5e9', stroke: '#164e63' },
            textColor: '#0284c7',
            textColorLight: '#7dd3fc33',
        })

        expect(readStoredLocalPeer(stored)).toEqual({
            name: 'Naruto Uzumaki',
            color: { background: '#0ea5e9', stroke: '#164e63' },
            textColor: '#0284c7',
            textColorLight: '#7dd3fc33',
        })
    })
})
