export type TextCommentAuthor = {
    id: string
    name: string
    textColor: string
    textColorLight: string
}

export type TextCommentMessage = {
    id: string
    body: string
    createdAt: string
    updatedAt: string
    author: TextCommentAuthor
}

export type TextCommentAnchor = {
    start: Uint8Array
    end: Uint8Array
}

export type TextCommentThread = {
    id: string
    quote: string
    createdAt: string
    updatedAt: string
    author: TextCommentAuthor
    anchor: TextCommentAnchor
    messages: TextCommentMessage[]
}
