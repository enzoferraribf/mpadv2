import type { Doc } from 'yjs'
import { assert } from './assert'
import { Y_DRAWING_APP_STATE_KEY } from './limits'

const DRAWING_TITLE_KEY = 'title'

export function readDrawingTitle(doc: Doc): string {
    const title = doc.getMap<string>(Y_DRAWING_APP_STATE_KEY).get(DRAWING_TITLE_KEY)
    return typeof title === 'string' ? title : ''
}

export function writeDrawingTitle(doc: Doc, title: string) {
    const nextTitle = title.trim()
    assert(nextTitle.length > 0, 'Drawing title is required')
    const state = doc.getMap<string>(Y_DRAWING_APP_STATE_KEY)
    if (state.get(DRAWING_TITLE_KEY) === nextTitle) return
    doc.transact(() => {
        state.set(DRAWING_TITLE_KEY, nextTitle)
    })
}
