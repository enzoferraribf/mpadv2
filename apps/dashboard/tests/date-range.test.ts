import { describe, expect, test } from 'bun:test'
import {
    addDays,
    formatDateInTimeZone,
    parseStatsDateRange,
    zonedDateStartUtc,
} from '../src/server/date-range'

describe('date ranges', () => {
    test('parses inclusive dates as timezone day bounds', () => {
        const range = parseStatsDateRange(
            new URL('http://dashboard/api/stats?from=2026-03-29&to=2026-03-30'),
            'Europe/London',
        )

        expect(range.from).toBe('2026-03-29')
        expect(range.to).toBe('2026-03-30')
        expect(range.days).toEqual(['2026-03-29', '2026-03-30'])
        expect(range.startUtc.toISOString()).toBe('2026-03-29T00:00:00.000Z')
        expect(range.endUtc.toISOString()).toBe('2026-03-30T23:00:00.000Z')
    })

    test('formats dates in the configured timezone', () => {
        expect(
            formatDateInTimeZone(
                new Date('2026-05-01T22:30:00.000Z'),
                'Europe/London',
            ),
        ).toBe('2026-05-01')
    })

    test('adds days with stable ISO dates', () => {
        expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
        expect(
            zonedDateStartUtc('2026-01-01', 'Europe/London').toISOString(),
        ).toBe('2026-01-01T00:00:00.000Z')
    })
})
