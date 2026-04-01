export function assert(condition: boolean, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

export function assertNever(value: never, message?: string): never {
    throw new Error(message ?? `Unexpected value: ${JSON.stringify(value)}`)
}
