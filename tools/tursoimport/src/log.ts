const IMPORT_PROGRESS_BATCH_SIZE = 250

export type TursoimportLogger = ReturnType<typeof createLogger>

export function createLogger() {
    const startedAtMs = Date.now()

    return {
        progress(
            label: string,
            completed: number,
            total: number,
            details?: Record<string, unknown>,
        ) {
            if (!shouldLogProgress(completed, total)) return
            this.step(label, {
                completed,
                total,
                ...details,
            })
        },
        step(message: string, details?: Record<string, unknown>) {
            const payload = {
                elapsedMs: Date.now() - startedAtMs,
                ...details,
            }
            console.log(`[tursoimport] ${message} ${JSON.stringify(payload)}`)
        },
    }
}

export function createSilentLogger() {
    return {
        progress() {},
        step() {},
    }
}

function shouldLogProgress(completed: number, total: number) {
    return (
        completed === 1 ||
        completed === total ||
        completed % IMPORT_PROGRESS_BATCH_SIZE === 0
    )
}
