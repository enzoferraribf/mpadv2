/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_E2E?: string
    readonly VITE_MPAD_API_ORIGIN?: string
}

interface Window {
    __MPAD_TEST_HOST__?: string
}
