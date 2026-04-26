import type { DialogProps } from '@radix-ui/react-dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command as CommandPrimitive } from 'cmdk'
import { Search, X } from 'lucide-react'
import * as React from 'react'

export function CommandDialog({ children, ...props }: DialogProps) {
    return (
        <DialogPrimitive.Root {...props}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className='fixed inset-0 z-50 bg-black/84 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0' />
                <DialogPrimitive.Content className='dialog-panel fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 overflow-hidden p-0 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'>
                    <DialogPrimitive.Title className='sr-only'>
                        Live files dialog
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className='sr-only'>
                        Search and manage live files for this pad.
                    </DialogPrimitive.Description>
                    <Command className='[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:text-[0.65rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.15em] [&_[cmdk-group-heading]]:text-[--stone-text-dim] [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:border-t [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:border-[--stone-border] [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4 [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-0'>
                        {children}
                    </Command>
                    <DialogPrimitive.Close className='absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded border border-[--stone-border] bg-[--stone-elevated] text-[--stone-text-dim] transition hover:bg-[--stone-elevated] hover:text-[--stone-text-secondary] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:pointer-events-none'>
                        <X className='h-4 w-4' />
                        <span className='sr-only'>Close</span>
                    </DialogPrimitive.Close>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}

export const Command = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
    <CommandPrimitive
        ref={ref}
        className={joinClassNames(
            'flex h-full w-full flex-col overflow-hidden rounded-[1.35rem] bg-transparent text-popover-foreground',
            className,
        )}
        {...props}
    />
))
Command.displayName = 'Command'

export const CommandInput = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Input>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
    <div
        className='flex items-center border-b border-[--stone-border] px-4'
        cmdk-input-wrapper=''
    >
        <Search className='mr-3 h-4 w-4 shrink-0 text-[--stone-text-dim]' />
        <CommandPrimitive.Input
            ref={ref}
            className={joinClassNames(
                'flex h-14 w-full rounded-md bg-transparent py-3 text-sm text-[--stone-text] outline-none placeholder:text-[--stone-text-dim] disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            {...props}
        />
    </div>
))
CommandInput.displayName = 'CommandInput'

export const CommandList = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.List
        ref={ref}
        className={joinClassNames(
            'command-scroll max-h-[30rem] overflow-y-auto overflow-x-hidden pb-3',
            className,
        )}
        {...props}
    />
))
CommandList.displayName = 'CommandList'

export const CommandEmpty = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Empty>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
    <CommandPrimitive.Empty
        ref={ref}
        className='py-6 text-center text-sm'
        {...props}
    />
))
CommandEmpty.displayName = 'CommandEmpty'

export const CommandGroup = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Group>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Group
        ref={ref}
        className={joinClassNames(
            'overflow-hidden p-1 text-foreground',
            className,
        )}
        {...props}
    />
))
CommandGroup.displayName = 'CommandGroup'

function joinClassNames(...values: Array<string | undefined>) {
    return values.filter(Boolean).join(' ')
}
