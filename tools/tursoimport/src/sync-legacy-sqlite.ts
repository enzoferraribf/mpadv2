import { syncLegacyReplica } from './source'

const sqlitePath = process.env.TURSOIMPORT_SYNC_SQLITE_PATH
const syncUrl = process.env.TURSOIMPORT_SYNC_URL
const authToken = process.env.TURSOIMPORT_SYNC_AUTH_TOKEN

if (!sqlitePath) throw new Error('Missing TURSOIMPORT_SYNC_SQLITE_PATH')
if (!syncUrl) throw new Error('Missing TURSOIMPORT_SYNC_URL')
if (!authToken) throw new Error('Missing TURSOIMPORT_SYNC_AUTH_TOKEN')

await syncLegacyReplica({
    authToken,
    log: console.log,
    sqlitePath,
    syncUrl,
})
