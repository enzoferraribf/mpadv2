import type { PadPath } from './path'

export type PadTreeItem = {
    path: PadPath
    parentPath: PadPath | null
    name: string
}
