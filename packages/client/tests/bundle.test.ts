import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type ManifestChunk = {
    file: string
    imports?: string[]
}

describe('client bundle', () => {
    test('keeps drawing and removed editor code out of the initial route graph', () => {
        const manifest = JSON.parse(
            readFileSync(join(import.meta.dir, '..', 'dist', '.vite', 'manifest.json'), 'utf8'),
        ) as Record<string, ManifestChunk>

        const entry = manifest['index.html']
        expect(entry).toBeDefined()

        const files = Array.from(collectFiles(manifest, 'index.html'))
        const contents = files.map((file) =>
            readFileSync(join(import.meta.dir, '..', 'dist', file), 'utf8'),
        )

        for (const file of files) {
            expect(file).not.toContain('drawing-core')
            expect(file).not.toContain('drawing-workspace')
            expect(file).not.toContain('drawing-scene')
            expect(file).not.toContain('drawing-mermaid')
        }

        for (const content of contents) {
            expect(content).not.toContain('monaco')
            expect(content).not.toContain('react-syntax-highlighter')
            expect(content).not.toContain('refractor')
            expect(content).not.toContain('mermaid')
            expect(content).not.toContain('@excalidraw/excalidraw')
        }
    })
})

function collectFiles(manifest: Record<string, ManifestChunk>, name: string, seen = new Set<string>()) {
    const chunk = manifest[name]
    expect(chunk).toBeDefined()
    if (!chunk || seen.has(chunk.file)) return seen

    seen.add(chunk.file)
    for (const imported of chunk.imports ?? []) {
        collectFiles(manifest, imported, seen)
    }
    return seen
}
