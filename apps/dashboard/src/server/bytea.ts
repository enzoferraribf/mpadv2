export function readBytea(value: unknown): Uint8Array {
    if (value instanceof Uint8Array) {
        return new Uint8Array(
            value.buffer.slice(
                value.byteOffset,
                value.byteOffset + value.length,
            ),
        )
    }
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    if (typeof value === 'string') return readByteaString(value)
    throw new Error('Unsupported bytea value')
}

function readByteaString(value: string) {
    const hex = value.startsWith('\\x') ? value.slice(2) : value
    if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
        throw new Error('Invalid bytea hex value')
    }

    const bytes = new Uint8Array(hex.length / 2)
    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
    }
    return bytes
}
