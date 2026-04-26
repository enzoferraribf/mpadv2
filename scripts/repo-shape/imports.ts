import { existsSync } from 'node:fs'
import path from 'node:path'
import { browserOnlyPackages, removedFeaturePackages } from './constants'
import type { RepoShapeContext } from './context'
import { readRelative } from './context'
import { walkSourceFiles } from './walk'

export function checkImports(context: RepoShapeContext) {
    checkSources(context, 'apps/web/src', checkWebFile)
    checkSources(context, 'apps/api/src', checkApiFile)
    checkSources(context, 'packages', checkPackageFile)
}

function checkSources(
    context: RepoShapeContext,
    relativeRoot: string,
    check: (
        context: RepoShapeContext,
        filePath: string,
        specifiers: string[],
    ) => void,
) {
    const root = path.join(context.repoRoot, relativeRoot)
    if (!existsSync(root)) return

    walkSourceFiles(root, (filePath, source) => {
        check(context, filePath, readImportSpecifiers(source))
    })
}

function checkWebFile(
    context: RepoShapeContext,
    filePath: string,
    specifiers: string[],
) {
    for (const specifier of specifiers) {
        if (specifier.startsWith('#/')) {
            context.violations.push(
                `${readRelative(context, filePath)} imports api code via ${specifier}`,
            )
        }
        if (removedFeaturePackages.test(specifier)) {
            context.violations.push(
                `${readRelative(context, filePath)} imports removed feature package ${specifier}`,
            )
        }
    }
}

function checkApiFile(
    context: RepoShapeContext,
    filePath: string,
    specifiers: string[],
) {
    for (const specifier of specifiers) {
        if (specifier.startsWith('@/')) {
            context.violations.push(
                `${readRelative(context, filePath)} imports web code via ${specifier}`,
            )
        }
        if (removedFeaturePackages.test(specifier)) {
            context.violations.push(
                `${readRelative(context, filePath)} imports removed feature package ${specifier}`,
            )
        }
    }
}

function checkPackageFile(
    context: RepoShapeContext,
    filePath: string,
    specifiers: string[],
) {
    for (const specifier of specifiers) {
        if (specifier.startsWith('@/') || specifier.startsWith('#/')) {
            context.violations.push(
                `${readRelative(context, filePath)} imports app code via ${specifier}`,
            )
        }
        if (browserOnlyPackages.some((pattern) => pattern.test(specifier))) {
            context.violations.push(
                `${readRelative(context, filePath)} imports browser package ${specifier}`,
            )
        }
        if (removedFeaturePackages.test(specifier)) {
            context.violations.push(
                `${readRelative(context, filePath)} imports removed feature package ${specifier}`,
            )
        }
    }
}

function readImportSpecifiers(source: string) {
    return Array.from(
        source.matchAll(
            /(?:from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\))/g,
        ),
        (match) => match[1] ?? match[2] ?? match[3] ?? '',
    ).filter(Boolean)
}
