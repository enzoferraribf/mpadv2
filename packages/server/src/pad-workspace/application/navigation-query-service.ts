import type { PadPath, PadTreeItem } from '@mpad/shared'
import { listRelatedPads } from '../../pad-tree/infrastructure/repository'

export function listWorkspacePads(path: PadPath): Promise<PadTreeItem[]> {
    return listRelatedPads(path)
}
