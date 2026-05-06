import type { DailyActivityRow } from '@/shared/stats'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { DataTable } from './data-table'
import { formatBytes, formatNumber } from './lib'

export function DailyActivityTable({
    rows,
}: {
    rows: DailyActivityRow[]
}) {
    const columns = useDailyColumns()

    return (
        <section className='flex flex-col gap-4'>
            <DataTable
                columns={columns}
                data={rows}
                description='Created pads, edited pads, revision mix, and stored revision bytes.'
                empty='No daily activity in this range'
                filters={[
                    {
                        label: 'Active only',
                        value: 'active',
                        predicate: (row) => row.totalActivity > 0,
                    },
                ]}
                initialSorting={[{ id: 'date', desc: true }]}
                searchPlaceholder='Search dates'
                title='Daily activity'
            />
        </section>
    )
}

function useDailyColumns() {
    return useMemo<ColumnDef<DailyActivityRow>[]>(
        () => [
            { accessorKey: 'date', header: 'Date' },
            {
                accessorKey: 'padsCreated',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Created',
            },
            {
                accessorKey: 'padsEdited',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Edited',
            },
            {
                accessorKey: 'textRevisions',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Text revs',
            },
            {
                accessorKey: 'drawingRevisions',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Drawing revs',
            },
            {
                accessorKey: 'revisionBytes',
                cell: ({ getValue }) => formatBytes(Number(getValue())),
                header: 'Bytes',
            },
            {
                accessorKey: 'totalActivity',
                cell: ({ getValue }) => formatNumber(Number(getValue())),
                header: 'Total',
            },
        ],
        [],
    )
}
