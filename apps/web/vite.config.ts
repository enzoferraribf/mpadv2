import { writeFileSync } from 'node:fs'
import path from 'path'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { type Plugin, defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
    if (mode === 'production' && !process.env.VITE_MPAD_API_ORIGIN) {
        throw new Error(
            'VITE_MPAD_API_ORIGIN is required for production builds.',
        )
    }

    return {
        define: {
            global: 'globalThis',
        },
        plugins: [
            writeCloudflareHeaders(),
            TanStackRouterVite({ routesDirectory: './src/routes' }),
            react(),
        ],
        build: {
            manifest: true,
            modulePreload: false,
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@excalidraw/mermaid-to-excalidraw': path.resolve(
                    __dirname,
                    './vendor/noop-mermaid-to-excalidraw/index.js',
                ),
            },
            tsconfigPaths: true,
        },
    }
})

function writeCloudflareHeaders(): Plugin {
    return {
        name: 'mpad-cloudflare-headers',
        apply: 'build',
        closeBundle() {
            const apiOrigin = process.env.VITE_MPAD_API_ORIGIN
            if (!apiOrigin) return

            const url = new URL(apiOrigin)
            const websocketUrl = new URL(apiOrigin)
            websocketUrl.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'

            writeFileSync(
                path.resolve(__dirname, 'dist/_headers'),
                readCloudflareHeaders(url.origin, websocketUrl.origin),
            )
        },
    }
}

function readCloudflareHeaders(apiOrigin: string, websocketOrigin: string) {
    return `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ${apiOrigin} ${websocketOrigin}; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; upgrade-insecure-requests
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Robots-Tag: noindex, nofollow, noarchive

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache
`
}
