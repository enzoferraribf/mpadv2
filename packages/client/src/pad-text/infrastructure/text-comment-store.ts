import {
    Y_TEXT_COMMENT_MESSAGES_KEY,
    Y_TEXT_COMMENT_THREADS_KEY,
    Y_TEXT_KEY,
    type LocalPeer,
    type TextCommentAuthor,
    type TextCommentStatus,
} from '@mpad/shared'
import {
    Array as YArray,
    Map as YMap,
    Text as YText,
    createAbsolutePositionFromRelativePosition,
    createRelativePositionFromTypeIndex,
    decodeRelativePosition,
    encodeRelativePosition,
    type Doc,
} from 'yjs'

export type TextCommentSelection = {
    from: number
    to: number
    quote: string
}

export type TextCommentAnchorView = {
    from: number
    to: number
    detached: boolean
}

export type TextCommentMessageView = {
    id: string
    body: string
    createdAt: string
    updatedAt: string
    author: TextCommentAuthor
    canEdit: boolean
    canDelete: boolean
}

export type TextCommentThreadView = {
    id: string
    status: TextCommentStatus
    quote: string
    createdAt: string
    updatedAt: string
    author: TextCommentAuthor
    anchor: TextCommentAnchorView
    messages: TextCommentMessageView[]
    canDelete: boolean
}

export type TextCommentHighlight = {
    threadId: string
    from: number
    to: number
    status: TextCommentStatus
}

type Result<T = void> =
    | { ok: true; value: T }
    | { ok: false; error: string }

export type TextCommentResult<T = void> = Result<T>

type ControllerDeps = {
    createId?: () => string
    now?: () => string
}

export type TextCommentController = {
    createThread: (input: { selection: TextCommentSelection; body: string }) => Result<{ threadId: string }>
    deleteMessage: (input: { threadId: string; messageId: string }) => Result
    deleteThread: (threadId: string) => Result
    editMessage: (input: { threadId: string; messageId: string; body: string }) => Result
    getHighlightSpans: () => TextCommentHighlight[]
    getThread: (threadId: string) => TextCommentThreadView | null
    listThreads: () => TextCommentThreadView[]
    replyToThread: (input: { threadId: string; body: string }) => Result<{ messageId: string }>
    reopenThread: (threadId: string) => Result
    resolveThread: (threadId: string) => Result
    subscribe: (listener: () => void) => () => void
    validateSelection: (selection: TextCommentSelection | null) => Result
}

export function createTextCommentController(doc: Doc, localPeer: LocalPeer, deps: ControllerDeps = {}): TextCommentController {
    const createId = deps.createId ?? (() => crypto.randomUUID())
    const now = deps.now ?? (() => new Date().toISOString())
    const ytext = doc.getText(Y_TEXT_KEY)

    return {
        createThread(input) {
            const selectionResult = validateSelection(doc, input.selection)
            if (!selectionResult.ok) return selectionResult

            const bodyResult = validateBody(input.body)
            if (!bodyResult.ok) return bodyResult

            const threadId = createId()
            const messageId = createId()
            const timestamp = now()

            doc.transact(() => {
                const thread = new YMap<unknown>()
                const messages = new YArray<YMap<unknown>>()
                const message = createMessageMap({
                    author: toAuthor(localPeer),
                    body: input.body,
                    id: messageId,
                    timestamp,
                })

                thread.set('id', threadId)
                thread.set('status', 'active')
                thread.set('quote', input.selection.quote)
                thread.set('createdAt', timestamp)
                thread.set('updatedAt', timestamp)
                writeAuthor(thread, toAuthor(localPeer))
                thread.set('anchorStart', encodeRelativePosition(createRelativePositionFromTypeIndex(ytext, input.selection.from, 0)))
                thread.set('anchorEnd', encodeRelativePosition(createRelativePositionFromTypeIndex(ytext, input.selection.to, -1)))
                messages.push([message])
                thread.set(Y_TEXT_COMMENT_MESSAGES_KEY, messages)
                readThreads(doc).set(threadId, thread)
            })

            return { ok: true, value: { threadId } }
        },
        deleteMessage(input) {
            const thread = readThreadMap(doc, input.threadId)
            if (!thread) return error('Comment thread not found')
            const messages = readMessages(thread, true)
            const index = findMessageIndex(messages, input.messageId)
            if (index < 0) return error('Comment message not found')
            const message = messages.get(index)
            if (!(message instanceof YMap)) return error('Comment message is invalid')
            if (index === 0) return error('Delete the full thread instead')
            if (readAuthorId(message) !== localPeer.id) return error('Only the author can delete this reply')

            doc.transact(() => {
                messages.delete(index, 1)
                thread.set('updatedAt', now())
            })

            return ok()
        },
        deleteThread(threadId) {
            const thread = readThreadMap(doc, threadId)
            if (!thread) return error('Comment thread not found')
            if (readAuthorId(thread) !== localPeer.id) return error('Only the author can delete this thread')

            doc.transact(() => {
                readThreads(doc).delete(threadId)
            })

            return ok()
        },
        editMessage(input) {
            const bodyResult = validateBody(input.body)
            if (!bodyResult.ok) return bodyResult

            const thread = readThreadMap(doc, input.threadId)
            if (!thread) return error('Comment thread not found')
            const messages = readMessages(thread, true)
            const index = findMessageIndex(messages, input.messageId)
            if (index < 0) return error('Comment message not found')
            const message = messages.get(index)
            if (!(message instanceof YMap)) return error('Comment message is invalid')
            if (readAuthorId(message) !== localPeer.id) return error('Only the author can edit this comment')

            const timestamp = now()

            doc.transact(() => {
                message.set('body', input.body)
                message.set('updatedAt', timestamp)
                thread.set('updatedAt', timestamp)
            })

            return ok()
        },
        getHighlightSpans() {
            return readThreadViews(doc, localPeer.id)
                .filter((thread) => !thread.anchor.detached)
                .map((thread) => ({
                    threadId: thread.id,
                    from: thread.anchor.from,
                    to: thread.anchor.to,
                    status: thread.status,
                }))
        },
        getThread(threadId) {
            return readThreadViews(doc, localPeer.id).find((thread) => thread.id === threadId) ?? null
        },
        listThreads() {
            return readThreadViews(doc, localPeer.id)
        },
        replyToThread(input) {
            const bodyResult = validateBody(input.body)
            if (!bodyResult.ok) return bodyResult

            const thread = readThreadMap(doc, input.threadId)
            if (!thread) return error('Comment thread not found')
            const messages = readMessages(thread, true)
            const messageId = createId()
            const timestamp = now()

            doc.transact(() => {
                messages.push([createMessageMap({
                    author: toAuthor(localPeer),
                    body: input.body,
                    id: messageId,
                    timestamp,
                })])
                thread.set('updatedAt', timestamp)
            })

            return { ok: true, value: { messageId } }
        },
        reopenThread(threadId) {
            const thread = readThreadMap(doc, threadId)
            if (!thread) return error('Comment thread not found')

            doc.transact(() => {
                thread.set('status', 'active')
                thread.set('updatedAt', now())
            })

            return ok()
        },
        resolveThread(threadId) {
            const thread = readThreadMap(doc, threadId)
            if (!thread) return error('Comment thread not found')

            doc.transact(() => {
                thread.set('status', 'resolved')
                thread.set('updatedAt', now())
            })

            return ok()
        },
        subscribe(listener) {
            doc.on('update', listener)
            return () => doc.off('update', listener)
        },
        validateSelection(selection) {
            return validateSelection(doc, selection)
        },
    }
}

function readThreadViews(doc: Doc, localAuthorId: string) {
    const ytext = doc.getText(Y_TEXT_KEY)
    const threads = Array.from(readThreads(doc).entries())
        .map(([threadId, value]) => readThreadView(threadId, value, ytext, localAuthorId))
        .filter((thread): thread is TextCommentThreadView => thread !== null)

    return threads.sort((left, right) => {
        if (left.status !== right.status) return left.status === 'active' ? -1 : 1
        if (left.anchor.detached !== right.anchor.detached) return left.anchor.detached ? 1 : -1
        if (left.anchor.from !== right.anchor.from) return left.anchor.from - right.anchor.from
        return right.updatedAt.localeCompare(left.updatedAt)
    })
}

function readThreadView(threadId: string, value: unknown, ytext: YText, localAuthorId: string): TextCommentThreadView | null {
    if (!(value instanceof YMap)) return null

    const messages = readMessages(value, false)
        .toArray()
        .map((message, index) => readMessageView(message, localAuthorId, index > 0))
        .filter((message): message is TextCommentMessageView => message !== null)

    if (messages.length === 0) return null

    const author = readAuthor(value)
    const anchor = readAnchor(value, ytext)
    const status = readStatus(value)
    const createdAt = readString(value, 'createdAt')
    const updatedAt = readString(value, 'updatedAt')
    const quote = readString(value, 'quote')

    if (!author || !status || !createdAt || !updatedAt || !quote) return null

    return {
        id: threadId,
        status,
        quote,
        createdAt,
        updatedAt,
        author,
        anchor,
        messages,
        canDelete: author.id === localAuthorId,
    }
}

function readMessageView(value: unknown, localAuthorId: string, canDelete: boolean): TextCommentMessageView | null {
    if (!(value instanceof YMap)) return null

    const id = readString(value, 'id')
    const body = readString(value, 'body')
    const createdAt = readString(value, 'createdAt')
    const updatedAt = readString(value, 'updatedAt')
    const author = readAuthor(value)

    if (!id || !body || !createdAt || !updatedAt || !author) return null

    const isAuthor = author.id === localAuthorId

    return {
        id,
        body,
        createdAt,
        updatedAt,
        author,
        canEdit: isAuthor,
        canDelete: canDelete && isAuthor,
    }
}

function readAnchor(thread: YMap<unknown>, ytext: YText): TextCommentAnchorView {
    const startBytes = thread.get('anchorStart')
    const endBytes = thread.get('anchorEnd')
    const doc = ytext.doc
    if (!(startBytes instanceof Uint8Array) || !(endBytes instanceof Uint8Array)) {
        return { from: 0, to: 0, detached: true }
    }
    if (!doc) return { from: 0, to: 0, detached: true }

    const start = createAbsolutePositionFromRelativePosition(decodeRelativePosition(startBytes), doc)
    const end = createAbsolutePositionFromRelativePosition(decodeRelativePosition(endBytes), doc)
    if (!start || !end || start.type !== ytext || end.type !== ytext || start.index >= end.index) {
        return { from: 0, to: 0, detached: true }
    }

    return {
        from: start.index,
        to: end.index,
        detached: false,
    }
}

function validateSelection(doc: Doc, selection: TextCommentSelection | null): Result {
    if (!selection) return error('Select some text first')
    if (!Number.isInteger(selection.from) || !Number.isInteger(selection.to)) return error('Invalid comment range')
    if (selection.from < 0 || selection.to <= selection.from) return error('Select some text first')
    if (selection.quote.trim().length === 0) return error('Comments need real text, not blank space')

    const ytext = doc.getText(Y_TEXT_KEY)
    if (selection.to > ytext.length) return error('Comment range is outside the document')

    const overlap = readThreadViews(doc, '').find((thread) =>
        !thread.anchor.detached &&
        selection.from < thread.anchor.to &&
        selection.to > thread.anchor.from,
    )
    if (overlap) return error('Comments cannot overlap')

    return ok()
}

function validateBody(body: string): Result {
    if (body.trim().length === 0) return error('Comments cannot be empty')
    return ok()
}

function readThreads(doc: Doc) {
    return doc.getMap<YMap<unknown>>(Y_TEXT_COMMENT_THREADS_KEY)
}

function readThreadMap(doc: Doc, threadId: string) {
    const value = readThreads(doc).get(threadId)
    return value instanceof YMap ? value : null
}

function readMessages(thread: YMap<unknown>, create: boolean) {
    const value = thread.get(Y_TEXT_COMMENT_MESSAGES_KEY)
    if (value instanceof YArray) return value as YArray<YMap<unknown>>
    if (!create) return new YArray<YMap<unknown>>()
    const next = new YArray<YMap<unknown>>()
    thread.set(Y_TEXT_COMMENT_MESSAGES_KEY, next)
    return next
}

function findMessageIndex(messages: YArray<YMap<unknown>>, messageId: string) {
    return messages.toArray().findIndex((value) => value instanceof YMap && readString(value, 'id') === messageId)
}

function createMessageMap(input: {
    author: TextCommentAuthor
    body: string
    id: string
    timestamp: string
}) {
    const map = new YMap<unknown>()
    map.set('id', input.id)
    map.set('body', input.body)
    map.set('createdAt', input.timestamp)
    map.set('updatedAt', input.timestamp)
    writeAuthor(map, input.author)
    return map
}

function writeAuthor(map: YMap<unknown>, author: TextCommentAuthor) {
    map.set('authorId', author.id)
    map.set('authorName', author.name)
    map.set('authorTextColor', author.textColor)
    map.set('authorTextColorLight', author.textColorLight)
}

function readAuthor(map: YMap<unknown>): TextCommentAuthor | null {
    const id = readString(map, 'authorId')
    const name = readString(map, 'authorName')
    const textColor = readString(map, 'authorTextColor')
    const textColorLight = readString(map, 'authorTextColorLight')
    if (!id || !name || !textColor || !textColorLight) return null
    return { id, name, textColor, textColorLight }
}

function readAuthorId(map: YMap<unknown>) {
    return readString(map, 'authorId')
}

function toAuthor(peer: LocalPeer): TextCommentAuthor {
    return {
        id: peer.id,
        name: peer.name,
        textColor: peer.textColor,
        textColorLight: peer.textColorLight,
    }
}

function readStatus(map: YMap<unknown>): TextCommentStatus | null {
    const status = map.get('status')
    return status === 'active' || status === 'resolved' ? status : null
}

function readString(map: YMap<unknown>, key: string) {
    const value = map.get(key)
    return typeof value === 'string' ? value : null
}

function ok<T = void>(value?: T): Result<T> {
    return { ok: true, value: value as T }
}

function error<T = void>(message: string): Result<T> {
    return { ok: false, error: message }
}
