import type { PadPath } from '@mpad/core/pad-path'

export type PadTreeItem = {
    path: PadPath
    parentPath: PadPath | null
    name: string
}
