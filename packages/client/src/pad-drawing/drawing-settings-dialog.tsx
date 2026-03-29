import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { DrawingThemePreference } from './drawing-theme'

const options: Array<{
    value: DrawingThemePreference
    label: string
    description: string
    icon: typeof Monitor
}> = [
    { value: 'app', label: 'Match app', description: 'Use the app theme', icon: Monitor },
    { value: 'light', label: 'Light', description: 'Use Excalidraw light mode', icon: Sun },
    { value: 'dark', label: 'Dark', description: 'Use Excalidraw dark mode', icon: Moon },
]

export function DrawingSettingsDialog(input: {
    open: boolean
    onOpenChange: (open: boolean) => void
    preference: DrawingThemePreference
    onPreferenceChange: (preference: DrawingThemePreference) => void
}) {
    return (
        <Dialog open={input.open} onOpenChange={input.onOpenChange}>
            <DialogContent className="max-w-sm border-[--stone-border] bg-[--stone-surface] p-5">
                <DialogHeader className="space-y-2 text-left">
                    <DialogTitle>Drawing settings</DialogTitle>
                    <DialogDescription>Choose the Excalidraw theme.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-2" role="radiogroup" aria-label="Excalidraw theme">
                    {options.map((option) => {
                        const selected = option.value === input.preference

                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => input.onPreferenceChange(option.value)}
                                className={cn(
                                    'flex items-center gap-3 rounded-md border px-4 py-3 text-left transition',
                                    selected
                                        ? 'border-[--stone-accent] bg-[--stone-elevated] text-[--stone-text]'
                                        : 'border-[--stone-border] bg-[--stone-editor-bg] text-[--stone-text-secondary] hover:border-[--stone-text-dim] hover:text-[--stone-text]',
                                )}
                            >
                                <option.icon className="h-4 w-4 flex-none" />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium">{option.label}</span>
                                    <span className="block text-xs text-[--stone-text-dim]">{option.description}</span>
                                </span>
                            </button>
                        )
                    })}
                </div>
            </DialogContent>
        </Dialog>
    )
}
