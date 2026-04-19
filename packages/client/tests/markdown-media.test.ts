import { describe, expect, test } from 'bun:test'
import { sanitizeMarkdownMediaSource } from '@/pad-text/infrastructure/markdown-media'

describe('markdown media', () => {
    test('allows safe local and remote image sources', () => {
        expect(sanitizeMarkdownMediaSource('/images/note.png')).toBe(
            '/images/note.png',
        )
        expect(sanitizeMarkdownMediaSource('./note.png')).toBe('./note.png')
        expect(
            sanitizeMarkdownMediaSource('https://cdn.example.com/note.png'),
        ).toBe('https://cdn.example.com/note.png')
        expect(sanitizeMarkdownMediaSource('blob:note')).toBe('blob:note')
        expect(sanitizeMarkdownMediaSource('data:image/png;base64,abc')).toBe(
            'data:image/png;base64,abc',
        )
        expect(
            sanitizeMarkdownMediaSource('<https://cdn.example.com/note.png>'),
        ).toBe('https://cdn.example.com/note.png')
    })

    test('rejects unsafe image sources', () => {
        expect(
            sanitizeMarkdownMediaSource('http://cdn.example.com/note.png'),
        ).toBeNull()
        expect(
            sanitizeMarkdownMediaSource('javascript:alert(document.domain)'),
        ).toBeNull()
        expect(
            sanitizeMarkdownMediaSource('//cdn.example.com/note.png'),
        ).toBeNull()
        expect(sanitizeMarkdownMediaSource('file:///tmp/note.png')).toBeNull()
    })
})
