import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownPreviewPane } from '../src/pad-text/markdown-preview-pane'

describe('markdown preview', () => {
    test('highlights fenced code blocks', () => {
        const html = renderToStaticMarkup(createElement(MarkdownPreviewPane, {
            content: '```js\nconst total = 1\n```',
        }))

        expect(html).toContain('hljs')
        expect(html).toContain('hljs-keyword')
    })

    test('keeps unknown languages as plain code', () => {
        const html = renderToStaticMarkup(createElement(MarkdownPreviewPane, {
            content: '```madeuplang\nplain words\n```',
        }))

        expect(html).toContain('plain words')
    })
})
