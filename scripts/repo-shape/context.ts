import path from 'node:path'

export type RepoShapeContext = {
    repoRoot: string
    violations: string[]
}

export function createRepoShapeContext(): RepoShapeContext {
    return {
        repoRoot: process.cwd(),
        violations: [],
    }
}

export function readRelative(context: RepoShapeContext, filePath: string) {
    return path.relative(context.repoRoot, filePath)
}
