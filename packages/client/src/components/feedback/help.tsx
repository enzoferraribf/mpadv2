import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'

export function Help({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="dialog-scroll max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Mpad</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 text-sm text-[--stone-text-secondary]">
                    <div>
                        <h3 className="mb-3 text-lg font-medium text-[--stone-text]">What is Mpad?</h3>
                        <p className="text-[--stone-text-secondary]">
                            Mpad is a collaborative markdown workspace with live preview, shared drawing, and peer-backed
                            file sharing. Text and drawings persist automatically. Shared files stay with connected peers.{' '}
                            <a
                                href="https://github.com/enzoferraribf/mmpad"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 align-baseline text-[--stone-accent] hover:opacity-80"
                            >
                                <ExternalLink className="h-4 w-4" />
                                GitHub
                            </a>
                        </p>
                    </div>

                    <div>
                        <h3 className="mb-3 text-lg font-medium text-[--stone-text]">Keyboard Shortcuts</h3>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">Ctrl + ,</Badge>
                                <span>Command menu</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">Ctrl + .</Badge>
                                <span className="text-sm">Explorer</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">Ctrl + ;</Badge>
                                <span className="text-sm">Files</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="mb-3 text-lg font-medium text-[--stone-text]">Markdown</h3>
                        <div className="ml-4 space-y-2">
                            <div className="rounded-md border border-[--stone-border] bg-[--stone-elevated] p-3 font-mono text-xs"># Header 1</div>
                            <div className="rounded-md border border-[--stone-border] bg-[--stone-elevated] p-3 font-mono text-xs">**bold** *italic* ~~strike~~ `code`</div>
                            <div className="rounded-md border border-[--stone-border] bg-[--stone-elevated] p-3 font-mono text-xs">- Bullet list</div>
                            <div className="rounded-md border border-[--stone-border] bg-[--stone-elevated] p-3 font-mono text-xs">[Link](url) ![Image](url)</div>
                            <div className="rounded-md border border-[--stone-border] bg-[--stone-elevated] p-3 font-mono text-xs">```js{'\n'}code block{'\n'}```</div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
