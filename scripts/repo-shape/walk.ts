import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { skippedEntries } from './constants'

export function walkFiles(
    root: string,
    visit: (filePath: string, source: string) => void,
) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (skippedEntries.has(entry.name)) continue

        const fullPath = path.join(root, entry.name)
        if (entry.isDirectory()) {
            walkFiles(fullPath, visit)
            continue
        }
        visit(fullPath, readFileSync(fullPath, 'utf8'))
    }
}

export function walkSourceFiles(
    root: string,
    visit: (filePath: string, source: string) => void,
) {
    walkFiles(root, (filePath, source) => {
        if (!/\.(ts|tsx|js|mjs)$/.test(filePath)) return
        visit(filePath, source)
    })
}
