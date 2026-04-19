/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_E2E?: string
}

interface Window {
    __MPAD_TEST_HOST__?: string
}
