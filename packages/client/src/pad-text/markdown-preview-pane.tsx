import ReactMarkdown from 'react-markdown'
import RemarkGfm from 'remark-gfm'

const remarkPlugins = [RemarkGfm]

export function MarkdownPreviewPane({ content }: { content: string }) {
    if (!content.trim()) {
        return (
            <div className="flex h-full items-center justify-center text-center text-sm text-[--stone-text-dim]">
                Preview appears here as you write.
            </div>
        )
    }

    return (
        <ReactMarkdown className="markdown-body" remarkPlugins={remarkPlugins}>
            {content}
        </ReactMarkdown>
    )
}
