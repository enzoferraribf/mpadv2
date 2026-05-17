import type { TextEditorHandle } from '@/features/text'
import type { PadWorkspaceShellModel } from '@/features/workspace/application/controller'
import { FileDown, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'

const markdownPreviewPanePromise = () =>
    import('@/features/text/view/preview-pane')
type MarkdownPreviewPaneComponent = Awaited<
    ReturnType<typeof markdownPreviewPanePromise>
>['MarkdownPreviewPane']

export function PadTopBar(input: {
    shell: PadWorkspaceShellModel
    textEditor?: TextEditorHandle | null
}) {
    const { commands, view } = input.shell
    const [pdfContent, setPdfContent] = useState<string | null>(null)
    const [MarkdownPdfPreview, setMarkdownPdfPreview] =
        useState<MarkdownPreviewPaneComponent | null>(null)
    const [printRequested, setPrintRequested] = useState(false)

    useEffect(() => {
        if (!printRequested || pdfContent === null) return

        const frame = window.requestAnimationFrame(() => {
            window.print()
            setPrintRequested(false)
        })

        return () => window.cancelAnimationFrame(frame)
    }, [pdfContent, printRequested])

    async function exportPdf() {
        const content = input.textEditor?.readContent()
        if (!content) return

        const previewPane = await markdownPreviewPanePromise()

        if (/(^|\n)\s{0,3}(```|~~~)/.test(content)) {
            await previewPane.preloadMarkdownHighlighter()
        }

        setMarkdownPdfPreview(() => previewPane.MarkdownPreviewPane)
        setPdfContent(content)
        setPrintRequested(true)
    }

    return (
        <div className='app-topbar'>
            <div className='app-topbar-left'>
                <button
                    className='app-topbar-toggle'
                    onClick={commands.toggleSidebar}
                    title='Toggle sidebar (Ctrl+B)'
                >
                    &#x2630;
                </button>
            </div>
            <div className='app-topbar-center'>
                <a href='/' className='mpad-logo'>
                    <span className='mpad-logo-m'>M</span>PAD
                </a>
            </div>
            <div className='app-topbar-right'>
                <div className='pad-tabs'>
                    <button
                        className={`pad-tab${view.activeTab === 'text' ? ' active' : ''}`}
                        onClick={() => commands.openTab('text')}
                    >
                        {view.padName}
                    </button>
                    <button
                        className={`pad-tab${view.activeTab === 'drawing' ? ' active' : ''}`}
                        onClick={() => commands.openTab('drawing')}
                    >
                        Drawing
                    </button>
                </div>
                {view.activeTab === 'text' ? (
                    <div className='pad-tab-actions'>
                        <button
                            className={`pad-tab-action${view.layout === 'split' ? ' active' : ''}`}
                            onClick={() => commands.setLayout('split')}
                            title='Split view'
                        >
                            &#x2637;
                        </button>
                        <button
                            className={`pad-tab-action${view.layout === 'editor' ? ' active' : ''}`}
                            onClick={() => commands.setLayout('editor')}
                            title='Editor only'
                        >
                            &#x270E;
                        </button>
                        <button
                            className={`pad-tab-action${view.layout === 'preview' ? ' active' : ''}`}
                            onClick={() => commands.setLayout('preview')}
                            title='Preview only'
                        >
                            &#x25C9;
                        </button>
                        <button
                            className='pad-tab-action'
                            onClick={exportPdf}
                            title='Export PDF'
                            aria-label='Export PDF'
                            disabled={!input.textEditor}
                        >
                            <FileDown className='h-4 w-4' />
                        </button>
                    </div>
                ) : null}
                {view.activeTab === 'drawing' ? (
                    <div className='pad-tab-actions'>
                        <button
                            className={`pad-tab-action${view.dialog === 'drawing-settings' ? ' active' : ''}`}
                            onClick={() =>
                                commands.toggleDialog('drawing-settings')
                            }
                            title='Drawing settings'
                            aria-label='Drawing settings'
                        >
                            <Settings2 className='h-4 w-4' />
                        </button>
                    </div>
                ) : null}
            </div>
            {pdfContent === null || MarkdownPdfPreview === null ? null : (
                <div className='markdown-pdf-export' aria-hidden='true'>
                    <MarkdownPdfPreview content={pdfContent} />
                </div>
            )}
        </div>
    )
}
