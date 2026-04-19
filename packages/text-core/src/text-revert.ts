import { Y_TEXT_KEY } from '@mpad/core/pad-limits'
import { Doc, type Doc as YDoc, applyUpdate } from 'yjs'

export function restoreTextDocFromUpdate(
    doc: YDoc,
    update: Uint8Array,
    origin: unknown = null,
) {
    const source = new Doc()
    applyUpdate(source, update)
    const content = source.getText(Y_TEXT_KEY).toString()
    source.destroy()

    doc.transact(() => {
        const ytext = doc.getText(Y_TEXT_KEY)
        if (ytext.length > 0) ytext.delete(0, ytext.length)
        if (content.length > 0) ytext.insert(0, content)
    }, origin)
}
