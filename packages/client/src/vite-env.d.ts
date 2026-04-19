/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_E2E?: string
    readonly VITE_HTTP_SERVER_ORIGIN?: string
    readonly VITE_WS_SERVER_ORIGIN?: string
}

type MpadClientRuntimeConfig = {
    httpServerOrigin?: string
    wsServerOrigin?: string
}

interface Window {
    __MPAD_CONFIG__?: MpadClientRuntimeConfig
    __MPAD_TEST_HOST__?: string
}
