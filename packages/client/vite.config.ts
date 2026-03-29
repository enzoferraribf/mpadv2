import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'

export default defineConfig({
    plugins: [TanStackRouterVite({ routesDirectory: './src/routes' }), react()],
    build: {
        manifest: true,
        modulePreload: false,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('vite/preload-helper')) return 'runtime-preload'
                    if (isFrameworkChunk(id)) return 'framework-core'
                    if (isUiChunk(id)) return 'ui-core'
                    if (isCollabChunk(id)) return 'collab-core'
                    if (isEditorChunk(id)) return 'editor-codemirror'
                    if (isPreviewChunk(id)) return 'preview-markdown'
                    if (isDrawingMermaidChunk(id)) return 'drawing-mermaid'
                    if (isDrawingChunk(id)) return 'drawing-core'
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})

function isFrameworkChunk(id: string) {
    return chunkIncludes(id, [
        '/react@',
        '/react-dom@',
        '/scheduler@',
        '/@tanstack+react-router@',
        '/next-themes@',
    ])
}

function isUiChunk(id: string) {
    return chunkIncludes(id, [
        '/@radix-ui+',
        '/cmdk@',
        '/react-resizable-panels@',
        '/lucide-react@',
        '/sonner@',
        '/class-variance-authority@',
        '/clsx@',
        '/tailwind-merge@',
    ])
}

function isCollabChunk(id: string) {
    return chunkIncludes(id, [
        '/yjs@',
        '/y-protocols@',
        '/lib0@',
        '/simple-peer@',
        '/y-codemirror.next@',
    ])
}

function isEditorChunk(id: string) {
    return chunkIncludes(id, [
        '/@codemirror+',
        '/@lezer+',
    ])
}

function isPreviewChunk(id: string) {
    return chunkIncludes(id, [
        '/react-markdown@',
        '/remark-gfm@',
        '/remark-',
        '/micromark',
        '/mdast-',
        '/hast-',
        '/unist-',
        '/unified@',
        '/decode-named-character-reference@',
    ])
}

function isDrawingMermaidChunk(id: string) {
    return chunkIncludes(id, [
        '/@excalidraw+mermaid-to-excalidraw@',
        '/mermaid@',
        '/katex@',
    ])
}

function isDrawingChunk(id: string) {
    return chunkIncludes(id, [
        '/@excalidraw+excalidraw@',
        '/@excalidraw+laser-pointer@',
        '/browser-fs-access@',
        '/image-blob-reduce@',
        '/pica@',
        '/roughjs@',
    ])
}

function chunkIncludes(id: string, values: string[]) {
    return values.some((value) => id.includes(value))
}
