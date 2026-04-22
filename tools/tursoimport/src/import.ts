import { loadImportConfig } from './config'
import { buildPadRows, convertLegacyPadRow } from './convert'
import { createLogger } from './log'
import {
    readLegacySourceRows,
    selectLegacyPadRows,
    syncLegacySqlite,
} from './source'
import {
    applyLegacyImport,
    migrateTargetDatabase,
    openTargetDatabase,
} from './target'
import type { ConvertedLegacyPad, ImportSummary } from './types'
import { formatDatabaseUrl } from './utils'

export async function runTursoimport(configPath?: string) {
    const logger = createLogger()
    const config = await loadImportConfig(configPath)

    logger.step('start', {
        configPath: config.configPath,
        legacySource: formatDatabaseUrl(config.tursoUrl),
        legacyRemoteProbeTimeoutMs: config.remoteProbeTimeoutMs,
        legacySyncTimeoutMs: config.syncTimeoutMs,
        sqlitePath: config.sqlitePath,
        targetDatabaseTls: config.targetDatabaseTls,
        targetDatabase: formatDatabaseUrl(config.targetDatabaseUrl),
    })

    await syncLegacySqlite(config, logger)

    logger.step('read sqlite rows start')
    const sourceRows = readLegacySourceRows(config.sqlitePath)
    logger.step('read sqlite rows done', { sourceRows: sourceRows.length })

    logger.step('select legacy pads start')
    const selected = selectLegacyPadRows(sourceRows)
    logger.step('select legacy pads done', {
        duplicatePathsCollapsed: selected.duplicatePaths,
        selectedPads: selected.rows.length,
    })

    logger.step('convert legacy pads start', { total: selected.rows.length })
    const pads: ConvertedLegacyPad[] = []
    for (const [index, row] of selected.rows.entries()) {
        pads.push(convertLegacyPadRow(row))
        logger.progress('convert legacy pads', index + 1, selected.rows.length)
    }
    logger.step('convert legacy pads done', { total: pads.length })

    logger.step('build pad rows start')
    const padRows = buildPadRows(pads)
    logger.step('build pad rows done', { total: padRows.length })

    const sql = openTargetDatabase(
        config.targetDatabaseUrl,
        config.targetDatabaseTls,
    )

    try {
        logger.step('postgres migration start')
        await migrateTargetDatabase(sql)
        logger.step('postgres migration done')

        logger.step('postgres import start', {
            padRows: padRows.length,
            pads: pads.length,
        })
        const targetStats = await applyLegacyImport(sql, pads, padRows, logger)
        logger.step('postgres import done', targetStats)

        const summary: ImportSummary = {
            configPath: config.configPath,
            convertedPads: pads.length,
            drawingDocsCreated: targetStats.drawingDocsCreated,
            drawingRevisionsAppended: targetStats.drawingRevisionsAppended,
            duplicatePathsCollapsed: selected.duplicatePaths,
            emptyPads: pads.filter(
                (pad) => !pad.hasTextContent && !pad.hasDrawingContent,
            ).length,
            legacySource: formatDatabaseUrl(config.tursoUrl),
            padRowsWritten: targetStats.padRowsWritten,
            placeholderPadsSkipped: pads.filter((pad) => pad.usedPlaceholder)
                .length,
            sourceRows: sourceRows.length,
            sqlitePath: config.sqlitePath,
            targetDatabase: formatDatabaseUrl(config.targetDatabaseUrl),
            targetPads: pads.length,
            textDocsCreated: targetStats.textDocsCreated,
            textRevisionsAppended: targetStats.textRevisionsAppended,
            unchangedDrawingDocs: targetStats.unchangedDrawingDocs,
            unchangedTextDocs: targetStats.unchangedTextDocs,
        }

        logger.step('done', summary)
        return summary
    } finally {
        await sql.close()
    }
}

if (import.meta.main) {
    const summary = await runTursoimport()
    console.log(JSON.stringify(summary, null, 2))
}
