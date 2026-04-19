import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { cn } from '@/lib/cn'
import type { DialogProps } from '@radix-ui/react-dialog'
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import * as React from 'react'

export const Command = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
    <CommandPrimitive
        ref={ref}
        className={cn(
            'flex h-full w-full flex-col overflow-hidden rounded-[1.35rem] bg-transparent text-popover-foreground',
            className,
        )}
        {...props}
    />
))
Command.displayName = 'Command'

export function CommandDialog({ children, ...props }: DialogProps) {
    return (
        <Dialog {...props}>
            <DialogContent className='max-w-2xl overflow-hidden p-0'>
                <VisuallyHidden>
                    <DialogTitle>Command Dialog</DialogTitle>
                </VisuallyHidden>
                <Command className='[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:text-[0.65rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.15em] [&_[cmdk-group-heading]]:text-[--stone-text-dim] [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:border-t [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:border-[--stone-border] [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4 [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-0'>
                    {children}
                </Command>
            </DialogContent>
        </Dialog>
    )
}

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
            className={cn(
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
        className={cn(
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
        className={cn('overflow-hidden p-1 text-foreground', className)}
        {...props}
    />
))
CommandGroup.displayName = 'CommandGroup'

export const CommandItem = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Item
        ref={ref}
        className={cn(
            'relative flex cursor-default select-none items-center rounded-md px-2 py-2 text-sm outline-none transition aria-selected:bg-[--stone-elevated] aria-selected:text-[--stone-text] data-[disabled="true"]:pointer-events-none data-[disabled="true"]:opacity-50',
            className,
        )}
        {...props}
    />
))
CommandItem.displayName = 'CommandItem'
