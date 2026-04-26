import type { PadPath } from '@mpad/core/pad-path'
import type { PadTreeItem } from '@mpad/protocol/pad-tree'

export interface PadTreeRepository {
    ensurePad: (path: PadPath) => Promise<void>
    listRelatedPads: (path: PadPath) => Promise<PadTreeItem[]>
}
