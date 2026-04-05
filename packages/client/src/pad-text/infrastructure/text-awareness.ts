import type { TextAwarenessState, TextAwarenessUser } from '@/collab/domain/pad-room-session'

export function createTextAwarenessState(user: TextAwarenessUser): TextAwarenessState {
    return { user }
}

export function readTextAwarenessStates(states: Iterable<[number, unknown]>) {
    const nextStates = new Map<number, TextAwarenessState>()

    for (const [peerId, state] of states) {
        const nextState = readTextAwarenessState(state)
        if (!nextState) continue
        nextStates.set(peerId, nextState)
    }

    return nextStates
}

function readTextAwarenessState(value: unknown): TextAwarenessState | null {
    if (!isRecord(value)) return null

    const user = readTextAwarenessUser(value.user)
    if (!user) return null

    return { user }
}

function readTextAwarenessUser(value: unknown): TextAwarenessUser | null {
    if (!isRecord(value)) return null
    if (typeof value.name !== 'string') return null
    if (typeof value.color !== 'string') return null
    if (typeof value.colorLight !== 'string') return null

    return {
        name: value.name,
        color: value.color,
        colorLight: value.colorLight,
    }
}
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}
