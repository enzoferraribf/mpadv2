export const allowedTopLevel = new Set([
    '.github',
    '.dockerignore',
    '.env',
    '.env.example',
    '.gitignore',
    '.vscode',
    'assets',
    'apps',
    'biome.json',
    'bun.lock',
    'compose.local.yml',
    'compose.dokploy.yml',
    'Dockerfile',
    'drizzle.config.ts',
    'package.json',
    'packages',
    'playwright.config.ts',
    'README.md',
    'scripts',
    'tests',
    'tools',
    'tsconfig.base.json',
    'tsconfig.browser.json',
    'tsconfig.bun.json',
    'tsconfig.lib.json',
    'tsconfig.workspace.json',
])

export const allowedApps = new Set(['api', 'web'])
export const allowedPackages = new Set(['core', 'protocol', 'testkit'])

export const browserOnlyPackages = [
    /^react$/,
    /^react-dom$/,
    /^@radix-ui\//,
    /^@codemirror\//,
    /^@excalidraw\//,
    /^cmdk$/,
    /^github-markdown-css$/,
    /^lucide-react$/,
    /^next-themes$/,
    /^react-markdown$/,
    /^react-resizable-panels$/,
    /^rehype-/,
    /^remark-/,
    /^sonner$/,
]

export const removedFeaturePackages =
    /@mpad\/(drawing|files|realtime|shell|text|tree)/

export const skippedEntries = new Set([
    '.git',
    '.tmp',
    '.turbo',
    'dist',
    'node_modules',
])
