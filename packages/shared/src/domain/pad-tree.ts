import type { PadPath } from './pad-path'

export type PadTreeItem = {
    path: PadPath
    parentPath: PadPath | null
    name: string
}
