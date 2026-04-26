import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@libsql/client'
import type { TursoimportLogger } from './log'
import type { ImportConfig } from './types'
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
        syncTimeoutMs: config.syncTimeoutMs,
        syncTarget: formatDatabaseUrl(config.tursoUrl),
    })
    await runLegacySyncWorker(config, logger)
    logger.step('sync legacy sqlite done', {
        sqlitePath: config.sqlitePath,
        syncTarget: formatDatabaseUrl(config.tursoUrl),
    })
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
    syncTimeoutMs?: number
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
                syncTimeoutMs: input.syncTimeoutMs,
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
                TURSOIMPORT_SYNC_TIMEOUT_MS: String(config.syncTimeoutMs),
                TURSOIMPORT_SYNC_URL: config.tursoUrl,
            },
            stdio: ['ignore', 'inherit', 'inherit'],
        })

        let settled = false
        let timedOut = false
        const timeoutId = setTimeout(() => {
            timedOut = true
            child.kill('SIGKILL')
        }, config.syncTimeoutMs + 5_000)
        const heartbeatId = setInterval(() => {
            logger.step('sync legacy sqlite waiting', {
                sqlitePath: config.sqlitePath,
                syncTimeoutMs: config.syncTimeoutMs,
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
                            `Legacy Turso sync worker did not exit within ${config.syncTimeoutMs + 5_000}ms while talking to ${formatDatabaseUrl(config.tursoUrl)}.`,
                        ),
                    )
                    return
                }

                if (code === 124) {
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
