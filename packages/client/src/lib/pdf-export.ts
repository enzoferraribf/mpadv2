export async function exportToPdf(content: string, theme: string) {
    const { marked } = await import('marked')
    const html = marked.parse(content, { async: false }) as string

    const isDark = theme === 'dark'
    const bg = isDark ? '#0d1117' : '#ffffff'
    const fg = isDark ? '#e6edf3' : '#1f2328'

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
        <html>
        <head>
            <style>
                body { background: ${bg}; color: ${fg}; font-family: -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                pre { background: ${isDark ? '#161b22' : '#f6f8fa'}; padding: 16px; border-radius: 6px; overflow-x: auto; }
                code { font-family: 'Geist Mono', monospace; font-size: 13px; }
                img { max-width: 100%; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid ${isDark ? '#30363d' : '#d0d7de'}; padding: 8px; }
            </style>
        </head>
        <body>${html}</body>
        </html>
    `)
    printWindow.document.close()
    printWindow.print()
}
