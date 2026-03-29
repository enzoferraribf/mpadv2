export function onCtrlKeyPressed(key: string, callback: () => void): () => void {
    const handler = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === key) {
            e.preventDefault()
            callback()
        }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
}
