import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Monitor, Moon, Sun } from 'lucide-react'
import type { DrawingThemePreference } from '../domain/theme'

const options: Array<{
    value: DrawingThemePreference
    label: string
    description: string
    icon: typeof Monitor
}> = [
    {
        value: 'app',
        label: 'Match app',
        description: 'Use the app theme',
        icon: Monitor,
    },
    {
        value: 'light',
        label: 'Light',
        description: 'Use Excalidraw light mode',
        icon: Sun,
    },
    {
        value: 'dark',
        label: 'Dark',
        description: 'Use Excalidraw dark mode',
        icon: Moon,
    },
]

export function DrawingSettingsDialog(input: {
    open: boolean
    onOpenChange: (open: boolean) => void
    preference: DrawingThemePreference
    onPreferenceChange: (preference: DrawingThemePreference) => void
}) {
    return (
        <DialogPrimitive.Root
            open={input.open}
            onOpenChange={input.onOpenChange}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className='fixed inset-0 z-50 bg-black/84 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0' />
                <DialogPrimitive.Content className='dialog-panel fixed left-[50%] top-[50%] z-50 grid w-full max-w-sm translate-x-[-50%] translate-y-[-50%] gap-4 border-[--stone-border] bg-[--stone-surface] p-5 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'>
                    <div className='space-y-2 text-left'>
                        <DialogPrimitive.Title className='text-lg font-medium leading-none tracking-tight text-[--stone-text]'>
                            Drawing settings
                        </DialogPrimitive.Title>
                        <DialogPrimitive.Description className='text-sm text-[--stone-text-dim]'>
                            Choose the Excalidraw theme.
                        </DialogPrimitive.Description>
                    </div>

                    <div
                        className='grid gap-2'
                        role='radiogroup'
                        aria-label='Excalidraw theme'
                    >
                        {options.map((option) => {
                            const selected = option.value === input.preference

                            return (
                                <button
                                    key={option.value}
                                    type='button'
                                    role='radio'
                                    aria-checked={selected}
                                    onClick={() =>
                                        input.onPreferenceChange(option.value)
                                    }
                                    className={`flex items-center gap-3 rounded-md border px-4 py-3 text-left transition ${
                                        selected
                                            ? 'border-[--stone-accent] bg-[--stone-elevated] text-[--stone-text]'
                                            : 'border-[--stone-border] bg-[--stone-editor-bg] text-[--stone-text-secondary] hover:border-[--stone-text-dim] hover:text-[--stone-text]'
                                    }`}
                                >
                                    <option.icon className='h-4 w-4 flex-none' />
                                    <span className='min-w-0'>
                                        <span className='block text-sm font-medium'>
                                            {option.label}
                                        </span>
                                        <span className='block text-xs text-[--stone-text-dim]'>
                                            {option.description}
                                        </span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
