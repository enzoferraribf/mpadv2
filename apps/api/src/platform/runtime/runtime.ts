import type { PadPath } from '@mpad/core/pad-path'
import { postgresDocRepository } from '#/db/doc-repo'
import { ensurePad } from '#/db/tree-repo'
import type { ServerConfig } from '#/platform/env'
import { createRateLimiter } from '#/platform/runtime/rate-limit'
import type { DocRepository } from '#/workspace/doc-model'
import type { DocRoomRegistry } from '#/workspace/doc-registry'
import { createInMemoryDocRoomRegistry } from '#/workspace/memory-doc-registry'

export type ServerRuntime = {
    docRepository: DocRepository
    docRoomRegistry: DocRoomRegistry
    ensurePadExists: (path: PadPath) => Promise<void>
    limits: ServerConfig['limits']
    rateLimiter: ReturnType<typeof createRateLimiter>
}

export function createServerRuntime(
    limits: ServerConfig['limits'] = {
        maxRelatedPads: 100,
        maxRoomClients: 32,
        rateLimitWindowMs: 60_000,
        rateLimitWsUpgrades: 60,
    },
): ServerRuntime {
    return {
        docRepository: postgresDocRepository,
        docRoomRegistry: createInMemoryDocRoomRegistry(),
        ensurePadExists: ensurePad,
        limits,
        rateLimiter: createRateLimiter(limits),
    }
}
