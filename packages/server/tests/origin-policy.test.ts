import { describe, expect, test } from 'bun:test'
import { allowedCorsOrigin, isAllowedWebSocketOrigin } from '../src/infrastructure/origin'

describe('origin policy', () => {
    test('uses wildcard cors when app origin is unset', () => {
        expect(allowedCorsOrigin(null)).toBe('*')
    })

    test('uses configured cors origin in deploy mode', () => {
        expect(allowedCorsOrigin('https://app.example.com')).toBe('https://app.example.com')
    })

    test('accepts websocket upgrades from the configured origin', () => {
        expect(isAllowedWebSocketOrigin('https://app.example.com', 'https://app.example.com')).toBe(true)
    })

    test('rejects websocket upgrades from a different origin', () => {
        expect(isAllowedWebSocketOrigin('https://app.example.com', 'https://evil.example.com')).toBe(false)
    })
})
