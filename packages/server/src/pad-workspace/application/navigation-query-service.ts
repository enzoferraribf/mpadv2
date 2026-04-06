import type { PadPath } from '@mpad/core/pad-path'
import type { PadTreeItem } from '@mpad/protocol/pad-tree'
import { listRelatedPads } from '../../pad-tree/infrastructure/repository'

export function listWorkspacePads(path: PadPath): Promise<PadTreeItem[]> {
    return listRelatedPads(path)
}
