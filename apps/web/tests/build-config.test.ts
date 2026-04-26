import { describe, expect, test } from 'bun:test'
import config from '../vite.config'

describe('web build config', () => {
    test('requires api origin for production builds', () => {
        const previous = process.env.VITE_MPAD_API_ORIGIN
        delete process.env.VITE_MPAD_API_ORIGIN

        try {
            expect(() =>
                typeof config === 'function'
                    ? config({
                          command: 'build',
                          isPreview: false,
                          isSsrBuild: false,
                          mode: 'production',
                      })
                    : config,
            ).toThrow('VITE_MPAD_API_ORIGIN is required')
        } finally {
            if (previous === undefined) {
                delete process.env.VITE_MPAD_API_ORIGIN
            } else {
                process.env.VITE_MPAD_API_ORIGIN = previous
            }
        }
    })
})
