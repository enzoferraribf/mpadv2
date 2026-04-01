import type { PadPath } from '../kernel/pad-path'

export type PadTreeItem = {
    path: PadPath
    parentPath: PadPath | null
    name: string
}
