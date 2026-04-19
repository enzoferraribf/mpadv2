type WindowWithIdle = Window &
    typeof globalThis & {
        cancelIdleCallback?: (id: number) => void
        requestIdleCallback?: (
            callback: IdleRequestCallback,
            options?: IdleRequestOptions,
        ) => number
    }

export function scheduleIdleTask(callback: () => void, timeoutMs = 400) {
    if (typeof window === 'undefined') {
        callback()
        return () => {}
    }

    const idleWindow = window as WindowWithIdle

    if (typeof idleWindow.requestIdleCallback === 'function') {
        const id = idleWindow.requestIdleCallback(() => callback(), {
            timeout: timeoutMs,
        })
        return () => idleWindow.cancelIdleCallback?.(id)
    }

    const id = window.setTimeout(callback, timeoutMs)
    return () => window.clearTimeout(id)
}
