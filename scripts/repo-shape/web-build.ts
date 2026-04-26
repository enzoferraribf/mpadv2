import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { RepoShapeContext } from './context'

type WebManifest = Record<
    string,
    {
        file?: string
        imports?: string[]
        src?: string
    }
>

const forbiddenLandingImports = [
    /@codemirror/i,
    /@excalidraw/i,
    /simple-peer/i,
    /react-markdown/i,
    /remark-/i,
    /src\/features\/drawing/i,
    /src\/features\/files\/workspace/i,
    /src\/features\/text\/workspace/i,
    /src\/features\/text\/preview/i,
]

export function checkWebBuildManifest(context: RepoShapeContext) {
    const manifestPath = path.join(
        context.repoRoot,
        'apps',
        'web',
        'dist',
        '.vite',
        'manifest.json',
    )
    if (!existsSync(manifestPath)) return

    const manifest = JSON.parse(
        readFileSync(manifestPath, 'utf8'),
    ) as WebManifest
    if (!manifest['index.html']) return

    for (const key of collectStaticImports(manifest, 'index.html')) {
        const file = manifest[key]?.file ?? key
        const src = manifest[key]?.src ?? key
        if (
            forbiddenLandingImports.some((pattern) =>
                pattern.test(`${file} ${src}`),
            )
        ) {
            context.violations.push(
                `landing bundle imports lazy module ${file}`,
            )
        }
    }

    for (const [key, entry] of Object.entries(manifest)) {
        const file = entry.file ?? ''
        const src = entry.src ?? key
        if (
            /mermaid/i.test(`${file} ${src}`) &&
            !`${key} ${src}`.includes('vendor/noop-mermaid-to-excalidraw')
        ) {
            context.violations.push(`web build emits Mermaid module ${file}`)
        }
    }
}

function collectStaticImports(
    manifest: WebManifest,
    entryKey: string,
    seen = new Set<string>(),
) {
    if (seen.has(entryKey)) return seen
    seen.add(entryKey)

    for (const key of manifest[entryKey]?.imports ?? []) {
        collectStaticImports(manifest, key, seen)
    }

    return seen
}
