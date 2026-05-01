import { describe, expect, test } from 'bun:test'
import { buildHistogram } from '../src/server/histogram'

describe('histograms', () => {
    test('builds inclusive lower and exclusive upper bins', () => {
        expect(buildHistogram([0, 1, 99, 100, 1000], [0, 1, 100])).toEqual([
            { label: '0-0', count: 1 },
            { label: '1-99', count: 2 },
            { label: '100+', count: 2 },
        ])
    })
})
