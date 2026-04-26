import { syncLegacyReplica } from './source'
import { formatDatabaseUrl } from './utils'

const sqlitePath = process.env.TURSOIMPORT_SYNC_SQLITE_PATH
const syncUrl = process.env.TURSOIMPORT_SYNC_URL
const authToken = process.env.TURSOIMPORT_SYNC_AUTH_TOKEN
const syncTimeoutMs = process.env.TURSOIMPORT_SYNC_TIMEOUT_MS

if (!sqlitePath) throw new Error('Missing TURSOIMPORT_SYNC_SQLITE_PATH')
if (!syncUrl) throw new Error('Missing TURSOIMPORT_SYNC_URL')
if (!authToken) throw new Error('Missing TURSOIMPORT_SYNC_AUTH_TOKEN')
if (!syncTimeoutMs) throw new Error('Missing TURSOIMPORT_SYNC_TIMEOUT_MS')

const parsedSyncTimeoutMs = Number(syncTimeoutMs)
if (!Number.isInteger(parsedSyncTimeoutMs) || parsedSyncTimeoutMs <= 0) {
    throw new Error(`Invalid TURSOIMPORT_SYNC_TIMEOUT_MS: ${syncTimeoutMs}`)
}

const timeoutId = setTimeout(() => {
    console.error(
        `[tursoimport-sync] timeout ${JSON.stringify({
            sqlitePath,
            syncTimeoutMs: parsedSyncTimeoutMs,
            syncTarget: formatDatabaseUrl(syncUrl),
        })}`,
    )
    process.exit(124)
}, parsedSyncTimeoutMs)

try {
    await syncLegacyReplica({
        authToken,
        log: console.log,
        sqlitePath,
        syncTimeoutMs: parsedSyncTimeoutMs,
        syncUrl,
    })
} finally {
    clearTimeout(timeoutId)
}
