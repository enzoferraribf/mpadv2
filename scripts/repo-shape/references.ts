import path from 'node:path'
import type { RepoShapeContext } from './context'
import { readRelative } from './context'
import { walkFiles } from './walk'

const staleReferences = [
    'APP_ORIGIN',
    'packages/client',
    'packages/server',
    'packages/text-core',
    '@mpad/client',
    '@mpad/server',
    '@mpad/text-core',
]

export function checkMarkdownFiles(context: RepoShapeContext) {
    walkFiles(context.repoRoot, (filePath) => {
        if (!filePath.endsWith('.md')) return
        if (readRelative(context, filePath) === 'README.md') return
        context.violations.push(
            `unexpected markdown file ${readRelative(context, filePath)}`,
        )
    })
}

export function checkStaleReferences(context: RepoShapeContext) {
    walkFiles(context.repoRoot, (filePath, source) => {
        if (!/\.(json|md|sh|ts|tsx|yml|yaml|example)$/.test(filePath)) return
        if (readRelative(context, filePath) === 'scripts/check-repo-shape.ts')
            return
        if (
            path.dirname(readRelative(context, filePath)) ===
            'scripts/repo-shape'
        )
            return

        for (const stale of staleReferences) {
            if (!source.includes(stale)) continue
            context.violations.push(
                `${readRelative(context, filePath)} contains stale reference ${stale}`,
            )
        }
    })
}
