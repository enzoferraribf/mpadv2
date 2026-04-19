declare global {
    type MpadClientRuntimeConfig = {
        httpServerOrigin?: string
        wsServerOrigin?: string
    }

    interface Window {
        __MPAD_CONFIG__?: MpadClientRuntimeConfig
        __MPAD_TEST_HOST__?: string
        __mpad__?: any
        __mpadDrawingApi__?: any
    }
}

export {}
