import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView, drawSelection, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { createMarkdownImageWidgetExtension } from './image-widgets'

const editorMuted = 'var(--stone-text-muted)'

const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        backgroundColor: 'var(--stone-editor-bg)',
        color: 'var(--stone-text)',
        fontSize: '13px',
    },
    '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        lineHeight: '1.8',
    },
    '.cm-content': {
        minHeight: '100%',
        paddingTop: '36px',
        paddingBottom: '28px',
        caretColor: 'transparent',
    },
    '.cm-line': {
        paddingLeft: '8px',
        paddingRight: '24px',
    },
    '.cm-gutters': {
        minWidth: '40px',
        border: 'none',
        backgroundColor: 'transparent',
        color: editorMuted,
    },
    '.cm-gutterElement': {
        padding: '0 12px 0 14px',
        fontSize: '11px',
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
    },
    '.cm-activeLine': {
        backgroundColor: 'var(--stone-active-line-bg)',
    },
    '& .cm-cursorLayer .cm-cursor': {
        display: 'block',
        borderLeft: 'none !important',
        border: '1px solid var(--stone-editor-cursor) !important',
        backgroundColor: 'transparent !important',
        width: '1ch',
        marginLeft: '0 !important',
        boxSizing: 'border-box',
    },
    '.cm-selectionBackground': {
        backgroundColor: 'var(--stone-editor-selection) !important',
    },
    '.cm-ySelection': {
        borderRadius: '2px',
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
    },
    '.cm-line.cm-yLineSelection': {
        backgroundColor: 'transparent !important',
    },
    '.cm-ySelectionInfo': {
        top: '-1.9em',
        left: '-2px',
        opacity: '1',
        padding: '2px 7px',
        borderRadius: '999px',
        fontFamily: 'var(--font-ui)',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.02em',
        lineHeight: '1.2',
        boxShadow: 'var(--stone-overlay-shadow)',
        transition: 'none',
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
    },
    '.cm-ySelectionCaret': {
        marginLeft: '-1px',
        marginRight: '-1px',
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
    },
    '.cm-ySelectionCaretDot': {
        width: '0.5em',
        height: '0.5em',
        top: '-0.25em',
        left: '-0.25em',
        boxShadow: '0 0 0 2px var(--stone-editor-caret-shadow)',
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
    },
    '.cm-ySelectionCaret:hover > .cm-ySelectionInfo': {
        opacity: '1',
    },
})

const editorHighlight = syntaxHighlighting(
    HighlightStyle.define([
        {
            tag: tags.heading1,
            color: 'var(--stone-text)',
            fontWeight: '700',
            fontSize: '1.4em',
        },
        {
            tag: tags.heading2,
            color: 'var(--stone-text)',
            fontWeight: '600',
            fontSize: '1.2em',
        },
        {
            tag: tags.heading3,
            color: 'var(--stone-heading-accent)',
            fontWeight: '600',
            fontSize: '1.05em',
        },
        {
            tag: [tags.heading4, tags.heading5, tags.heading6],
            color: 'var(--stone-heading-accent)',
            fontWeight: '600',
        },
        { tag: tags.strong, color: 'var(--stone-text)', fontWeight: '600' },
        {
            tag: tags.emphasis,
            color: 'var(--stone-syntax-markdown)',
            fontStyle: 'italic',
        },
        {
            tag: tags.strikethrough,
            textDecoration: 'line-through',
            color: 'var(--stone-text-secondary)',
        },
        {
            tag: tags.link,
            color: 'var(--stone-accent)',
            textDecoration: 'underline',
        },
        { tag: tags.url, color: editorMuted },
        {
            tag: [tags.processingInstruction, tags.inserted],
            color: 'var(--stone-success)',
        },
        {
            tag: tags.monospace,
            color: 'var(--stone-text)',
            backgroundColor: 'var(--stone-inline-code-bg)',
        },
        { tag: [tags.meta, tags.comment], color: editorMuted },
        { tag: tags.labelName, color: 'var(--stone-heading-accent)' },
        { tag: tags.quote, color: editorMuted, fontStyle: 'italic' },
        { tag: tags.list, color: 'var(--stone-heading-accent)' },
        { tag: tags.contentSeparator, color: editorMuted },
    ]),
)

export function createMarkdownCodeMirrorExtensions() {
    return [
        markdown(),
        lineNumbers(),
        drawSelection(),
        EditorView.lineWrapping,
        createMarkdownImageWidgetExtension(),
        editorTheme,
        editorHighlight,
    ]
}
