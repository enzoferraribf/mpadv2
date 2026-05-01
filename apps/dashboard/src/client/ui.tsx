import type {
    ButtonHTMLAttributes,
    HTMLAttributes,
    InputHTMLAttributes,
} from 'react'
import { cn } from './lib'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <section
            className={cn(
                'rounded-md border border-border bg-card text-card-foreground shadow-sm',
                className,
            )}
            {...props}
        />
    )
}

export function Button({
    className,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            className={cn(
                'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:border-primary/60 hover:bg-accent disabled:pointer-events-none disabled:opacity-50',
                className,
            )}
            {...props}
        />
    )
}

export function Input({
    className,
    ...props
}: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cn(
                'h-9 rounded-md border border-border bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/25',
                className,
            )}
            {...props}
        />
    )
}

export function Table({
    columns,
    rows,
    empty,
}: {
    columns: string[]
    rows: Array<Array<string | number>>
    empty: string
}) {
    return (
        <div className='overflow-hidden rounded-md border border-border'>
            <table className='w-full border-collapse text-sm'>
                <thead className='bg-muted text-left text-muted-foreground'>
                    <tr>
                        {columns.map((column) => (
                            <th key={column} className='px-3 py-2 font-medium'>
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                className='px-3 py-6 text-center text-muted-foreground'
                                colSpan={columns.length}
                            >
                                {empty}
                            </td>
                        </tr>
                    ) : (
                        rows.map((row) => (
                            <tr
                                key={row.join('|')}
                                className='border-t border-border odd:bg-background'
                            >
                                {row.map((cell, cellIndex) => (
                                    <td
                                        key={columns[cellIndex] ?? cell}
                                        className='max-w-[22rem] truncate px-3 py-2'
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
