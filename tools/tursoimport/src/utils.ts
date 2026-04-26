import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { PadDocKind } from '@mpad/core/pad-room'

export const moduleRootPath = path.resolve(import.meta.dir, '..')
export const repoRootPath = path.resolve(moduleRootPath, '../..')
export const defaultImportConfigPath = path.join(moduleRootPath, '.env.local')
export const migrationsDirectoryPath = path.join(
    repoRootPath,
    'apps/api/src/db/migrations',
)

export async function parseEnvFile(filePath: string) {
    const text = await readFile(filePath, 'utf8')
    const values: Record<string, string> = {}

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (line.length === 0 || line.startsWith('#')) continue

        const normalized = line.startsWith('export ')
            ? line.slice('export '.length).trim()
            : line
        const index = normalized.indexOf('=')
        if (index === -1) continue

        const key = normalized.slice(0, index).trim()
        const rawValue = normalized.slice(index + 1).trim()
        values[key] = stripWrappingQuotes(rawValue)
    }

    return values
}

export function readPositiveInteger(
    value: string | undefined,
    fallback: number,
    key: string,
) {
    if (!value) return fallback

    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid ${key}: ${value}`)
    }

    return parsed
}

export function resolveModulePath(value: string) {
    return path.isAbsolute(value) ? value : path.resolve(moduleRootPath, value)
}

export function inferDatabaseTls(databaseUrl: string) {
    try {
        const url = new URL(databaseUrl)
        const host = url.hostname.trim().toLowerCase()
        return !(host === 'localhost' || host === '127.0.0.1' || host === '::1')
    } catch {
        return false
    }
}

export function formatDatabaseUrl(value: string) {
    try {
        const url = new URL(value)
        const databaseName = url.pathname.replace(/^\//, '')
        const port = url.port || defaultPort(url.protocol)
        const host = port ? `${url.hostname}:${port}` : url.hostname
        return `${url.protocol}//${host}/${databaseName}`
    } catch {
        return 'invalid'
    }
}

export function defaultPort(protocol: string) {
    if (protocol === 'postgres:' || protocol === 'postgresql:') return '5432'
    if (protocol === 'https:') return '443'
    if (protocol === 'http:') return '80'
    return ''
}

export function toIsoTimestamp(value: number | Date | string) {
    if (typeof value === 'number') {
        return new Date(value).toISOString()
    }

    return (value instanceof Date ? value : new Date(value)).toISOString()
}

export function toNumber(value: bigint | number | string) {
    if (typeof value === 'number') return value
    if (typeof value === 'bigint') return Number(value)
    return Number(value)
}

export function bytesEqual(left: Uint8Array, right: Uint8Array) {
    if (left.byteLength !== right.byteLength) return false

    for (let index = 0; index < left.byteLength; index += 1) {
        if (left[index] !== right[index]) return false
    }

    return true
}

export function chunk<T>(items: T[], size: number) {
    const chunks: T[][] = []

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size))
    }

    return chunks
}

export function buildValuesClause(rows: unknown[][]) {
    const params: unknown[] = []
    const sql = rows
        .map((row) => {
            const placeholders = row.map((value) => {
                params.push(value)
                return `$${params.length}`
            })
            return `(${placeholders.join(', ')})`
        })
        .join(', ')

    return {
        params,
        sql,
    }
}

export function makeDocKey(path: string, kind: PadDocKind) {
    return `${path}:${kind}`
}

export function comparePadPathsByDepth(left: string, right: string) {
    const depthDiff = padDepth(left) - padDepth(right)
    if (depthDiff !== 0) return depthDiff
    return left.localeCompare(right)
}

export function toLegacySyncWorkerPath() {
    return path.join(import.meta.dir, 'sync-legacy-sqlite.ts')
}

function stripWrappingQuotes(value: string) {
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1)
    }

    return value
}

function padDepth(value: string) {
    return value.split('/').filter(Boolean).length
}
