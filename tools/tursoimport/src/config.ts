import { existsSync } from 'node:fs'
import path from 'node:path'
import type { ImportConfig } from './types'
import {
    defaultImportConfigPath,
    inferDatabaseTls,
    parseEnvFile,
    readPositiveInteger,
    resolveModulePath,
} from './utils'

export async function loadImportConfig(filePath = defaultImportConfigPath) {
    if (!existsSync(filePath)) {
        throw new Error(
            `Missing ${filePath}. Create it from ${path.join(path.dirname(filePath), 'env.example')} before running tursoimport.`,
        )
    }

    const env = await parseEnvFile(filePath)
    const tursoUrl = readRequiredValue(
        readConfigValue(
            env,
            'TURSOIMPORT_TURSO_URL',
            'LEGACY_IMPORT_TURSO_URL',
        ),
        'TURSOIMPORT_TURSO_URL',
        filePath,
    )
    const tursoToken = readRequiredValue(
        readConfigValue(
            env,
            'TURSOIMPORT_TURSO_TOKEN',
            'LEGACY_IMPORT_TURSO_TOKEN',
        ),
        'TURSOIMPORT_TURSO_TOKEN',
        filePath,
    )
    const targetDatabaseUrl = readRequiredValue(
        readConfigValue(
            env,
            'TURSOIMPORT_TARGET_DATABASE_URL',
            'LEGACY_IMPORT_TARGET_DATABASE_URL',
        ),
        'TURSOIMPORT_TARGET_DATABASE_URL',
        filePath,
    )

    const sqlitePath = resolveModulePath(
        readConfigValue(
            env,
            'TURSOIMPORT_SQLITE_PATH',
            'LEGACY_IMPORT_SQLITE_PATH',
        ) ?? '.tmp/legacy-turso.db',
    )

    const config: ImportConfig = {
        configPath: filePath,
        remoteProbeTimeoutMs: readPositiveInteger(
            readConfigValue(
                env,
                'TURSOIMPORT_REMOTE_PROBE_TIMEOUT_MS',
                'LEGACY_IMPORT_REMOTE_PROBE_TIMEOUT_MS',
            ),
            15_000,
            'TURSOIMPORT_REMOTE_PROBE_TIMEOUT_MS',
        ),
        sqlitePath,
        syncTimeoutMs: readPositiveInteger(
            readConfigValue(
                env,
                'TURSOIMPORT_SYNC_TIMEOUT_MS',
                'LEGACY_IMPORT_SYNC_TIMEOUT_MS',
            ),
            300_000,
            'TURSOIMPORT_SYNC_TIMEOUT_MS',
        ),
        targetDatabaseTls: readBooleanLikeValue(
            readConfigValue(
                env,
                'TURSOIMPORT_TARGET_DATABASE_TLS',
                'LEGACY_IMPORT_TARGET_DATABASE_TLS',
            ),
            inferDatabaseTls(targetDatabaseUrl),
            'TURSOIMPORT_TARGET_DATABASE_TLS',
        ),
        targetDatabaseUrl,
        tursoToken,
        tursoUrl,
    }

    return config
}

function readRequiredValue(
    value: string | undefined,
    key: string,
    filePath: string,
) {
    if (!value) {
        throw new Error(`Missing ${key} in ${filePath}.`)
    }

    return value
}

function readConfigValue(
    env: Record<string, string>,
    preferredKey: string,
    legacyKey: string,
) {
    return env[preferredKey] ?? env[legacyKey]
}

function readBooleanLikeValue(
    value: string | undefined,
    fallback: boolean,
    key: string,
) {
    if (!value) return fallback

    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false

    throw new Error(`Invalid ${key}: ${value}`)
}
