import { describe, expect, test } from 'bun:test'
import {
    MarkdownPreviewPane,
    preloadMarkdownHighlighter,
} from '@/pad-text/markdown-preview-pane'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

describe('markdown preview', () => {
    test('highlights fenced code blocks', async () => {
        await preloadMarkdownHighlighter()

        const html = renderToStaticMarkup(
            createElement(MarkdownPreviewPane, {
                content: '```js\nconst total = 1\n```',
            }),
        )

        expect(html).toContain('hljs')
        expect(html).toContain('hljs-keyword')
    })

    test('keeps unknown languages as plain code', () => {
        const html = renderToStaticMarkup(
            createElement(MarkdownPreviewPane, {
                content: '```madeuplang\nplain words\n```',
            }),
        )

        expect(html).toContain('plain words')
    })

    test('labels task list checkboxes for assistive tech', () => {
        const html = renderToStaticMarkup(
            createElement(MarkdownPreviewPane, {
                content: '- [x] done\n- [ ] todo',
            }),
        )

        expect(html).toContain('aria-label="Completed task"')
        expect(html).toContain('aria-label="Incomplete task"')
        expect(html).toContain('tabindex="-1"')
    })
})
