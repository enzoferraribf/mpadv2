import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { allowedApps, allowedPackages, allowedTopLevel } from './constants'
import type { RepoShapeContext } from './context'

export function checkRepoStructure(context: RepoShapeContext) {
    checkTopLevel(context)
    checkWorkspaceNames(context, 'apps', allowedApps)
    checkWorkspaceNames(context, 'packages', allowedPackages)
    checkDddShape(context)
    checkNoFeatureLocalCommandDialogs(context)
}

function checkTopLevel(context: RepoShapeContext) {
    for (const entry of readdirSync(context.repoRoot)) {
        if (isIgnoredTopLevel(entry)) continue
        if (!allowedTopLevel.has(entry)) {
            context.violations.push(`unexpected top-level entry ${entry}`)
        }
    }
}

function isIgnoredTopLevel(entry: string) {
    return (
        entry === '.DS_Store' ||
        entry === '.git' ||
        entry === '.tmp' ||
        entry === '.turbo' ||
        entry === 'node_modules' ||
        entry === 'screenshots'
    )
}

function checkWorkspaceNames(
    context: RepoShapeContext,
    name: string,
    allowed: Set<string>,
) {
    const dir = path.join(context.repoRoot, name)
    if (!existsSync(dir)) return

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        if (entry.name === 'node_modules' || entry.name.startsWith('.'))
            continue
        if (!allowed.has(entry.name)) {
            context.violations.push(
                `unexpected ${name} workspace ${entry.name}`,
            )
        }
    }
}

function checkDddShape(context: RepoShapeContext) {
    for (const legacy of [
        'apps/api/src/app',
        'apps/api/src/features',
        'apps/api/src/http',
        'apps/api/src/ws',
    ]) {
        if (existsSync(path.join(context.repoRoot, legacy))) {
            context.violations.push(
                `legacy api boundary still exists at ${legacy}`,
            )
        }
    }

    checkDirectoryEntries(
        context,
        'apps/api/src',
        new Set([
            'db',
            'files',
            'index.ts',
            'platform',
            'schema-migrate.ts',
            'tree',
            'workspace',
        ]),
    )

    for (const featureRoot of [
        'apps/web/src/features/drawing',
        'apps/web/src/features/files',
        'apps/web/src/features/text',
        'apps/web/src/features/tree',
        'apps/web/src/features/workspace',
    ]) {
        checkNoRootDomainFile(context, featureRoot)
    }

    checkDirectoryEntries(
        context,
        'apps/web/src/shared/realtime',
        new Set(['application', 'client', 'domain']),
    )
}

function checkDirectoryEntries(
    context: RepoShapeContext,
    relativeDir: string,
    allowed: Set<string>,
) {
    const dir = path.join(context.repoRoot, relativeDir)
    if (!existsSync(dir)) return

    for (const entry of readdirSync(dir)) {
        if (!allowed.has(entry)) {
            context.violations.push(`unexpected entry ${relativeDir}/${entry}`)
        }
    }
}

function checkNoRootDomainFile(context: RepoShapeContext, relativeDir: string) {
    const dir = path.join(context.repoRoot, relativeDir)
    if (!existsSync(dir)) return

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile()) continue
        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx'))
            continue
        if (entry.name === 'index.ts') continue
        context.violations.push(
            `${relativeDir}/${entry.name} should live under domain or application`,
        )
    }
}

function checkNoFeatureLocalCommandDialogs(context: RepoShapeContext) {
    const featuresDir = path.join(context.repoRoot, 'apps/web/src/features')
    if (!existsSync(featuresDir)) return

    for (const feature of readdirSync(featuresDir, { withFileTypes: true })) {
        if (!feature.isDirectory()) continue
        const relativePath = `apps/web/src/features/${feature.name}/view/command-dialog.tsx`
        if (!existsSync(path.join(context.repoRoot, relativePath))) continue
        context.violations.push(
            `${relativePath} should use apps/web/src/shared/ui/command.tsx`,
        )
    }
}
