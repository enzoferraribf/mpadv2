export function onCtrlKeyPressed(
    key: string,
    callback: () => void,
): () => void {
    const handler = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === key) {
            event.preventDefault()
            callback()
        }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
}
