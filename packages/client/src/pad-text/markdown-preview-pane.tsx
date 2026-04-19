import type { ComponentProps } from 'react'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import RemarkGfm from 'remark-gfm'

const remarkPlugins = [RemarkGfm]
type RehypePlugin = NonNullable<
    ComponentProps<typeof ReactMarkdown>['rehypePlugins']
>[number]
const markdownComponents: Components = {
    input({ node: _node, checked, type, ...props }) {
        if (type !== 'checkbox') return <input {...props} type={type} />

        return (
            <input
                {...props}
                aria-label={checked ? 'Completed task' : 'Incomplete task'}
                checked={Boolean(checked)}
                readOnly
                tabIndex={-1}
                type='checkbox'
            />
        )
    },
}

let highlightPlugin: RehypePlugin | null = null
let highlightPluginPromise: Promise<RehypePlugin> | null = null

export function preloadMarkdownHighlighter() {
    highlightPluginPromise ??= import('rehype-highlight').then((mod) => {
        highlightPlugin = mod.default as RehypePlugin
        return highlightPlugin
    })

    return highlightPluginPromise
}

export function MarkdownPreviewPane({ content }: { content: string }) {
    const wantsHighlight = hasMarkdownFence(content)
    const [, setHighlightVersion] = useState(0)

    useEffect(() => {
        if (!wantsHighlight || highlightPlugin) return

        let active = true

        void preloadMarkdownHighlighter().then(() => {
            if (!active) return
            setHighlightVersion((value) => value + 1)
        })

        return () => {
            active = false
        }
    }, [wantsHighlight])

    if (!content.trim()) {
        return (
            <div className='flex h-full items-center justify-center text-center text-sm text-[--stone-text-muted]'>
                Preview appears here as you write.
            </div>
        )
    }

    return (
        <ReactMarkdown
            className='markdown-body'
            components={markdownComponents}
            rehypePlugins={
                wantsHighlight && highlightPlugin
                    ? [highlightPlugin]
                    : undefined
            }
            remarkPlugins={remarkPlugins}
        >
            {content}
        </ReactMarkdown>
    )
}

function hasMarkdownFence(content: string) {
    return /(^|\n)\s{0,3}(```|~~~)/.test(content)
}
