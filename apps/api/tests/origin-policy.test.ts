import { describe, expect, test } from 'bun:test'
import {
    isAllowedWebSocketOrigin,
    readCorsOrigin,
} from '#/platform/http/origin'

describe('origin policy', () => {
    test('does not emit cors headers when client origin is unset', () => {
        expect(readCorsOrigin(null, 'https://app.example.com')).toBeNull()
    })

    test('uses configured cors origin for the same origin only', () => {
        expect(
            readCorsOrigin(
                'https://app.example.com',
                'https://app.example.com',
            ),
        ).toBe('https://app.example.com')
    })

    test('does not emit cors headers for a different origin', () => {
        expect(
            readCorsOrigin(
                'https://app.example.com',
                'https://evil.example.com',
            ),
        ).toBeNull()
    })

    test('accepts websocket upgrades from the configured origin', () => {
        expect(
            isAllowedWebSocketOrigin(
                'https://app.example.com',
                'https://app.example.com',
            ),
        ).toBe(true)
    })

    test('rejects websocket upgrades from a different origin', () => {
        expect(
            isAllowedWebSocketOrigin(
                'https://app.example.com',
                'https://evil.example.com',
            ),
        ).toBe(false)
    })

    test('rejects websocket upgrades when client origin is unset', () => {
        expect(isAllowedWebSocketOrigin(null, 'https://app.example.com')).toBe(
            false,
        )
    })
})
