import type {
    ColumnDef,
    SortingState,
    Table as TableInstance,
} from '@tanstack/react-table'
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import type { MouseEventHandler, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { cn } from './lib'
import { Button, Card, Input } from './ui'

export type TableFilter<T> = {
    label: string
    value: string
    predicate: (row: T) => boolean
}

export function DataTable<T>({
    title,
    description,
    data,
    columns,
    empty,
    searchPlaceholder,
    initialSorting,
    filters = [],
    pageSize = 10,
}: {
    title: string
    description?: string
    data: T[]
    columns: ColumnDef<T>[]
    empty: string
    searchPlaceholder: string
    initialSorting: SortingState
    filters?: Array<TableFilter<T>>
    pageSize?: number
}) {
    const [sorting, setSorting] = useState<SortingState>(initialSorting)
    const [globalFilter, setGlobalFilter] = useState('')
    const [activeFilter, setActiveFilter] = useState('all')

    const filteredData = useMemo(() => {
        const filter = filters.find((item) => item.value === activeFilter)
        return filter ? data.filter(filter.predicate) : data
    }, [activeFilter, data, filters])

    const table = useReactTable({
        data: filteredData,
        columns,
        state: { sorting, globalFilter },
        initialState: { pagination: { pageSize } },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: (row, _columnId, filterValue) => {
            const query = String(filterValue).toLowerCase()
            return row.getAllCells().some((cell) =>
                String(cell.getValue() ?? '')
                    .toLowerCase()
                    .includes(query),
            )
        },
    })

    return (
        <Card className='overflow-hidden'>
            <div className='flex flex-wrap items-start justify-between gap-3 border-border border-b p-4'>
                <div>
                    <h2 className='font-semibold text-base'>{title}</h2>
                    {description ? (
                        <p className='mt-1 text-muted-foreground text-sm'>
                            {description}
                        </p>
                    ) : null}
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    {filters.length > 0 ? (
                        <div className='flex rounded-md border border-border bg-background p-1'>
                            <FilterButton
                                active={activeFilter === 'all'}
                                label='All'
                                onClick={() => {
                                    setActiveFilter('all')
                                    table.setPageIndex(0)
                                }}
                            />
                            {filters.map((filter) => (
                                <FilterButton
                                    active={activeFilter === filter.value}
                                    key={filter.value}
                                    label={filter.label}
                                    onClick={() => {
                                        setActiveFilter(filter.value)
                                        table.setPageIndex(0)
                                    }}
                                />
                            ))}
                        </div>
                    ) : null}
                    <div className='relative block'>
                        <Search className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-muted-foreground' />
                        <Input
                            aria-label={`Search ${title}`}
                            className='w-[260px] pl-9'
                            placeholder={searchPlaceholder}
                            value={globalFilter}
                            onChange={(event) => {
                                setGlobalFilter(event.target.value)
                                table.setPageIndex(0)
                            }}
                        />
                    </div>
                </div>
            </div>
            <div className='overflow-x-auto'>
                <table className='w-full border-collapse text-sm'>
                    <thead className='bg-muted/60 text-left text-muted-foreground'>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        className='whitespace-nowrap px-4 py-3 font-medium'
                                        key={header.id}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <HeaderButton
                                                canSort={header.column.getCanSort()}
                                                direction={header.column.getIsSorted()}
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext(),
                                                )}
                                            </HeaderButton>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td
                                    className='px-4 py-10 text-center text-muted-foreground'
                                    colSpan={columns.length}
                                >
                                    {empty}
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    className='border-border border-t transition hover:bg-muted/45'
                                    key={row.id}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            className='max-w-[42rem] px-4 py-3 align-top'
                                            key={cell.id}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <TableFooter table={table} />
        </Card>
    )
}

function FilterButton({
    active,
    label,
    onClick,
}: {
    active: boolean
    label: string
    onClick: () => void
}) {
    return (
        <button
            className={cn(
                'h-7 rounded-sm px-2.5 font-medium text-xs transition',
                active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            onClick={onClick}
            type='button'
        >
            {label}
        </button>
    )
}

function HeaderButton({
    canSort,
    children,
    direction,
    onClick,
}: {
    canSort: boolean
    children: ReactNode
    direction: false | 'asc' | 'desc'
    onClick: MouseEventHandler<HTMLButtonElement> | undefined
}) {
    let Icon = ArrowUpDown
    if (direction === 'asc') Icon = ArrowUp
    if (direction === 'desc') Icon = ArrowDown

    return (
        <button
            className={cn(
                'inline-flex items-center gap-2',
                canSort && 'hover:text-foreground',
            )}
            disabled={!canSort}
            onClick={onClick}
            type='button'
        >
            {children}
            {canSort ? <Icon className='h-3.5 w-3.5' /> : null}
        </button>
    )
}

function TableFooter<T>({ table }: { table: TableInstance<T> }) {
    const rows = table.getFilteredRowModel().rows.length
    const page = table.getState().pagination.pageIndex + 1
    const pageCount = table.getPageCount()

    return (
        <div className='flex flex-wrap items-center justify-between gap-3 border-border border-t p-4 text-muted-foreground text-sm'>
            <div>{rows} rows</div>
            <div className='flex flex-wrap items-center gap-2'>
                <span>Rows</span>
                <select
                    className='h-8 rounded-md border border-border bg-background px-2 text-foreground outline-none'
                    onChange={(event) =>
                        table.setPageSize(Number(event.target.value))
                    }
                    value={table.getState().pagination.pageSize}
                >
                    {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </select>
                <span>
                    Page {pageCount === 0 ? 0 : page} of {pageCount}
                </span>
                <Button
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => table.previousPage()}
                >
                    Previous
                </Button>
                <Button
                    disabled={!table.getCanNextPage()}
                    onClick={() => table.nextPage()}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}
