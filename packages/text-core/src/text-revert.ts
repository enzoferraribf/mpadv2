import {
    type TextCommentAuthor,
    type TextCommentMessage,
} from '@mpad/protocol/text-comments'
import {
    Y_TEXT_COMMENT_MESSAGES_KEY,
    Y_TEXT_COMMENT_THREADS_KEY,
    Y_TEXT_KEY,
} from '@mpad/core/pad-limits'
import {
    Array as YArray,
    Doc,
    Map as YMap,
    Text as YText,
    applyUpdate,
    createAbsolutePositionFromRelativePosition,
    createRelativePositionFromTypeIndex,
    decodeRelativePosition,
    encodeRelativePosition,
    type Doc as YDoc,
} from 'yjs'

type RestoredAnchor =
    | { kind: 'attached'; from: number; to: number }
    | { kind: 'detached'; start: Uint8Array; end: Uint8Array }

type RestoredThread = {
    id: string
    quote: string
    createdAt: string
    updatedAt: string
    author: TextCommentAuthor
    messages: TextCommentMessage[]
    anchor: RestoredAnchor
}

export function restoreTextDocFromUpdate(doc: YDoc, update: Uint8Array, origin: unknown = null) {
    const source = new Doc()
    applyUpdate(source, update)

    const content = source.getText(Y_TEXT_KEY).toString()
    const threads = readRestoredThreads(source)

    source.destroy()

    doc.transact(() => {
        const ytext = doc.getText(Y_TEXT_KEY)
        if (ytext.length > 0) ytext.delete(0, ytext.length)
        if (content.length > 0) ytext.insert(0, content)

        const ythreads = doc.getMap<YMap<unknown>>(Y_TEXT_COMMENT_THREADS_KEY)
        for (const key of Array.from(ythreads.keys())) ythreads.delete(key)
        for (const thread of threads) ythreads.set(thread.id, createThreadMap(thread, ytext))
    }, origin)
}

function readRestoredThreads(doc: YDoc) {
    const ytext = doc.getText(Y_TEXT_KEY)
    const threads = doc.getMap<YMap<unknown>>(Y_TEXT_COMMENT_THREADS_KEY)

    return Array.from(threads.entries())
        .map(([threadId, value]) => readRestoredThread(threadId, value, ytext))
        .filter((thread): thread is RestoredThread => thread !== null)
}

function readRestoredThread(threadId: string, value: unknown, ytext: YText) {
    if (!(value instanceof YMap)) return null

    const quote = readString(value, 'quote')
    const createdAt = readString(value, 'createdAt')
    const updatedAt = readString(value, 'updatedAt')
    const author = readAuthor(value)
    const messages = readMessages(value)
    const anchor = readAnchor(value, ytext)

    if (!quote || !createdAt || !updatedAt || !author || !anchor || messages.length === 0) return null

    return {
        id: threadId,
        quote,
        createdAt,
        updatedAt,
        author,
        messages,
        anchor,
    }
}

function readMessages(thread: YMap<unknown>) {
    const value = thread.get(Y_TEXT_COMMENT_MESSAGES_KEY)
    if (!(value instanceof YArray)) return []

    return value.toArray()
        .map((message) => readMessage(message))
        .filter((message): message is TextCommentMessage => message !== null)
}

function readMessage(value: unknown) {
    if (!(value instanceof YMap)) return null

    const id = readString(value, 'id')
    const body = readString(value, 'body')
    const createdAt = readString(value, 'createdAt')
    const updatedAt = readString(value, 'updatedAt')
    const author = readAuthor(value)

    if (!id || !body || !createdAt || !updatedAt || !author) return null

    return {
        id,
        body,
        createdAt,
        updatedAt,
        author,
    } satisfies TextCommentMessage
}

function readAnchor(thread: YMap<unknown>, ytext: YText): RestoredAnchor | null {
    const startBytes = thread.get('anchorStart')
    const endBytes = thread.get('anchorEnd')
    if (!(startBytes instanceof Uint8Array) || !(endBytes instanceof Uint8Array)) return null

    const doc = ytext.doc
    if (!doc) {
        return {
            kind: 'detached',
            start: new Uint8Array(startBytes),
            end: new Uint8Array(endBytes),
        }
    }

    const start = createAbsolutePositionFromRelativePosition(decodeRelativePosition(startBytes), doc)
    const end = createAbsolutePositionFromRelativePosition(decodeRelativePosition(endBytes), doc)
    if (!start || !end || start.type !== ytext || end.type !== ytext || start.index >= end.index) {
        return {
            kind: 'detached',
            start: new Uint8Array(startBytes),
            end: new Uint8Array(endBytes),
        }
    }

    return {
        kind: 'attached',
        from: start.index,
        to: end.index,
    }
}

function createThreadMap(thread: RestoredThread, ytext: YText) {
    const map = new YMap<unknown>()
    const messages = new YArray<YMap<unknown>>()

    map.set('id', thread.id)
    map.set('quote', thread.quote)
    map.set('createdAt', thread.createdAt)
    map.set('updatedAt', thread.updatedAt)
    writeAuthor(map, thread.author)

    if (thread.anchor.kind === 'attached') {
        map.set('anchorStart', encodeRelativePosition(createRelativePositionFromTypeIndex(ytext, thread.anchor.from, 0)))
        map.set('anchorEnd', encodeRelativePosition(createRelativePositionFromTypeIndex(ytext, thread.anchor.to, -1)))
    } else {
        map.set('anchorStart', new Uint8Array(thread.anchor.start))
        map.set('anchorEnd', new Uint8Array(thread.anchor.end))
    }

    for (const message of thread.messages) messages.push([createMessageMap(message)])
    map.set(Y_TEXT_COMMENT_MESSAGES_KEY, messages)

    return map
}

function createMessageMap(message: TextCommentMessage) {
    const map = new YMap<unknown>()
    map.set('id', message.id)
    map.set('body', message.body)
    map.set('createdAt', message.createdAt)
    map.set('updatedAt', message.updatedAt)
    writeAuthor(map, message.author)
    return map
}

function writeAuthor(map: YMap<unknown>, author: TextCommentAuthor) {
    map.set('authorId', author.id)
    map.set('authorName', author.name)
    map.set('authorTextColor', author.textColor)
    map.set('authorTextColorLight', author.textColorLight)
}

function readAuthor(map: YMap<unknown>) {
    const id = readString(map, 'authorId')
    const name = readString(map, 'authorName')
    const textColor = readString(map, 'authorTextColor')
    const textColorLight = readString(map, 'authorTextColorLight')
    if (!id || !name || !textColor || !textColorLight) return null
    return { id, name, textColor, textColorLight }
}

function readString(map: YMap<unknown>, key: string) {
    const value = map.get(key)
    return typeof value === 'string' ? value : null
}
