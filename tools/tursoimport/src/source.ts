import { Database } from 'bun:sqlite'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@libsql/client'
import { type PadPath, padPath } from '@mpad/core/pad-path'
import type { TursoimportLogger } from './log'
import type {
    ImportConfig,
    LegacyPadRow,
    SelectedLegacyPadRow,
    SourceRow,
} from './types'
import { formatDatabaseUrl, toLegacySyncWorkerPath } from './utils'

type SyncReplicaClient = {
    close(): void
    sync(): Promise<{
        frame_no: number
        frames_synced: number
    } | null>
}

export async function syncLegacySqlite(
    config: ImportConfig,
    logger: TursoimportLogger,
) {
    logger.step('legacy remote probe start', {
        probeTarget: formatDatabaseUrl(config.tursoUrl),
    })
    await probeLegacyTurso(config)
    logger.step('legacy remote probe done', {
        probeTarget: formatDatabaseUrl(config.tursoUrl),
    })

    logger.step('sync legacy sqlite start', {
        sqlitePath: config.sqlitePath,
        syncTarget: formatDatabaseUrl(config.tursoUrl),
    })
    await runLegacySyncWorker(config, logger)
    logger.step('sync legacy sqlite done', {
        sqlitePath: config.sqlitePath,
        syncTarget: formatDatabaseUrl(config.tursoUrl),
    })
}

export function readLegacySourceRows(sqlitePath: string) {
    const sqlite = new Database(sqlitePath, { create: false, readonly: true })

    try {
        const rows = sqlite
            .query(`
                SELECT id, content, last_update, last_transaction
                FROM pads
                ORDER BY id ASC
            `)
            .all() as SourceRow[]
        return rows.map(toLegacyPadRow)
    } finally {
        sqlite.close()
    }
}

export function selectLegacyPadRows(rows: LegacyPadRow[]) {
    const grouped = new Map<PadPath, LegacyPadRow[]>()

    for (const row of rows) {
        const normalizedPath = normalizeLegacyPadPath(row.id)
        const group = grouped.get(normalizedPath)
        if (group) {
            group.push(row)
            continue
        }
        grouped.set(normalizedPath, [row])
    }

    const selected = Array.from(grouped.entries(), ([path, group]) => {
        const preferred = [...group].sort(compareLegacyRows)[0]!
        return {
            ...preferred,
            path,
            rawIds: group.map((row) => row.id).sort(),
        }
    }).sort((left, right) => left.path.localeCompare(right.path))

    return {
        duplicatePaths: rows.length - selected.length,
        rows: selected,
    }
}

export function resolveLegacyTimestampMs(row: LegacyPadRow) {
    return Math.max(row.lastUpdate ?? 0, row.lastTransaction ?? 0)
}

export async function syncLegacyReplica(input: {
    authToken: string
    createReplicaClient?: (input: {
        authToken: string
        syncUrl: string
        url: string
    }) => SyncReplicaClient
    log?: (message: string) => void
    sqlitePath: string
    syncUrl: string
}) {
    await mkdir(path.dirname(input.sqlitePath), { recursive: true })

    const client = (input.createReplicaClient ?? createClient)({
        authToken: input.authToken,
        syncUrl: input.syncUrl,
        url: `file:${input.sqlitePath}`,
    }) as SyncReplicaClient

    try {
        input.log?.(
            `[tursoimport-sync] start ${JSON.stringify({
                sqlitePath: input.sqlitePath,
                syncTarget: formatDatabaseUrl(input.syncUrl),
            })}`,
        )

        const replicated = await client.sync()
        if (!replicated) {
            throw new Error('Legacy Turso sync returned no replication stats.')
        }

        input.log?.(
            `[tursoimport-sync] done ${JSON.stringify({
                frameNo: replicated.frame_no,
                framesSynced: replicated.frames_synced,
            })}`,
        )
    } finally {
        client.close()
    }
}

async function probeLegacyTurso(config: ImportConfig) {
    const client = createClient({
        authToken: config.tursoToken,
        url: config.tursoUrl,
    })

    try {
        await withTimeout(
            client.execute('SELECT 1'),
            config.remoteProbeTimeoutMs,
            `Legacy Turso probe timed out after ${config.remoteProbeTimeoutMs}ms while talking to ${formatDatabaseUrl(config.tursoUrl)}.`,
        )
    } finally {
        client.close()
    }
}

async function runLegacySyncWorker(
    config: ImportConfig,
    logger: TursoimportLogger,
) {
    const workerPath = toLegacySyncWorkerPath()

    await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, ['run', workerPath], {
            cwd: path.dirname(path.dirname(workerPath)),
            env: {
                ...process.env,
                TURSOIMPORT_SYNC_AUTH_TOKEN: config.tursoToken,
                TURSOIMPORT_SYNC_SQLITE_PATH: config.sqlitePath,
                TURSOIMPORT_SYNC_URL: config.tursoUrl,
            },
            stdio: ['ignore', 'inherit', 'inherit'],
        })

        let settled = false
        let timedOut = false
        const timeoutId = setTimeout(() => {
            timedOut = true
            child.kill('SIGKILL')
        }, config.syncTimeoutMs)
        const heartbeatId = setInterval(() => {
            logger.step('sync legacy sqlite waiting', {
                sqlitePath: config.sqlitePath,
                syncTarget: formatDatabaseUrl(config.tursoUrl),
            })
        }, 10_000)

        const finish = (callback: () => void) => {
            if (settled) return
            settled = true
            clearInterval(heartbeatId)
            clearTimeout(timeoutId)
            callback()
        }

        child.once('error', (error) => {
            finish(() => reject(error))
        })

        child.once('exit', (code, signal) => {
            finish(() => {
                if (timedOut) {
                    reject(
                        new Error(
                            `Legacy Turso sync timed out after ${config.syncTimeoutMs}ms while talking to ${formatDatabaseUrl(config.tursoUrl)}.`,
                        ),
                    )
                    return
                }

                if (code === 0) {
                    resolve()
                    return
                }

                reject(
                    new Error(
                        `Legacy Turso sync worker failed with code ${code ?? 'null'} and signal ${signal ?? 'null'}.`,
                    ),
                )
            })
        })
    })
}

async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_resolve, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(errorMessage))
                }, timeoutMs)
            }),
        ])
    } finally {
        if (timeoutId !== null) clearTimeout(timeoutId)
    }
}

function toLegacyPadRow(row: SourceRow): LegacyPadRow {
    return {
        content: row.content,
        id: row.id,
        lastTransaction: row.last_transaction,
        lastUpdate: row.last_update,
    }
}

function normalizeLegacyPadPath(value: string): PadPath {
    return padPath(value)
}

function compareLegacyRows(left: LegacyPadRow, right: LegacyPadRow) {
    const timestampDiff =
        resolveLegacyTimestampMs(right) - resolveLegacyTimestampMs(left)
    if (timestampDiff !== 0) return timestampDiff

    const canonicalDiff =
        Number(isCanonicalLegacyId(right.id)) -
        Number(isCanonicalLegacyId(left.id))
    if (canonicalDiff !== 0) return canonicalDiff

    const contentDiff = right.content.length - left.content.length
    if (contentDiff !== 0) return contentDiff

    return left.id.localeCompare(right.id)
}

function isCanonicalLegacyId(value: string) {
    return value === normalizeLegacyPadPath(value)
}
