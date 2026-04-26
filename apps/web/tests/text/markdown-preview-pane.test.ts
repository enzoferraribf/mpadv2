import { describe, expect, test } from 'bun:test'
import {
    MarkdownPreviewPane,
    preloadMarkdownHighlighter,
} from '@/features/text/view/preview-pane'
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

    test('drops unsafe image sources from the preview', () => {
        const html = renderToStaticMarkup(
            createElement(MarkdownPreviewPane, {
                content: '![x](http://evil.example.com/file.png)',
            }),
        )

        expect(html).not.toContain('<img')
    })

    test('keeps safe image sources in the preview', () => {
        const html = renderToStaticMarkup(
            createElement(MarkdownPreviewPane, {
                content: '![x](https://cdn.example.com/file.png)',
            }),
        )

        expect(html).toContain('<img')
        expect(html).toContain('https://cdn.example.com/file.png')
    })
})
