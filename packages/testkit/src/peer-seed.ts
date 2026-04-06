import type { LocalPeer } from '@mpad/protocol/peer'

export function createPeerSeed(
    name: string,
    background: string,
    stroke: string,
    textColor: string,
    textColorLight: string,
): LocalPeer {
    return {
        id: `peer-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`,
        name,
        color: { background, stroke },
        textColor,
        textColorLight,
    }
}
