import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TextCommentResult, TextCommentThreadView } from './text-comment-controller'
import type { TextCommentSelection } from './text-comment-controller'

type CommentActionResult<T = void> = TextCommentResult<T>

export function TextCommentsPane(input: {
    containerHeight: number
    draftSelection: TextCommentSelection | null
    onClose: () => void
    onCreateThread: (body: string) => CommentActionResult<{ threadId: string }>
    onDeleteMessage: (input: { threadId: string; messageId: string }) => CommentActionResult
    onDeleteThread: (threadId: string) => CommentActionResult
    onEditMessage: (input: { threadId: string; messageId: string; body: string }) => CommentActionResult
    onReopenThread: (threadId: string) => CommentActionResult
    onReplyToThread: (input: { threadId: string; body: string }) => CommentActionResult<{ messageId: string }>
    onResolveThread: (threadId: string) => CommentActionResult
    top: number
    thread: TextCommentThreadView | null
}) {
    const cardRef = useRef<HTMLElement | null>(null)
    const [composerBody, setComposerBody] = useState('')
    const [editingBody, setEditingBody] = useState('')
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [replyBody, setReplyBody] = useState('')
    const [resolvedTop, setResolvedTop] = useState(12)
    const open = input.draftSelection !== null || input.thread !== null

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            input.onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [input.onClose, open])

    useEffect(() => {
        setComposerBody('')
        setError(null)
    }, [input.draftSelection])

    useEffect(() => {
        setEditingBody('')
        setEditingMessageId(null)
        setReplyBody('')
        setError(null)
    }, [input.thread?.id])

    useLayoutEffect(() => {
        if (!open) return
        const card = cardRef.current
        if (!card) return
        const height = card.offsetHeight
        const maxTop = Math.max(12, input.containerHeight - height - 12)
        setResolvedTop(Math.max(12, Math.min(input.top, maxTop)))
    }, [input.containerHeight, input.top, input.thread, input.draftSelection, editingMessageId, editingBody, open, replyBody])

    if (!open) return null

    return (
        <aside
            ref={cardRef}
            className="comment-card"
            data-testid="comment-card"
            style={{ top: `${resolvedTop}px` }}
        >
            <header className="comment-card-header">
                <div className="comments-compose-label">
                    {input.draftSelection ? 'New comment' : input.thread?.status === 'resolved' ? 'Resolved thread' : 'Thread'}
                </div>
                <button
                    aria-label="Close comment"
                    className="comment-card-close"
                    onClick={input.onClose}
                    type="button"
                >
                    ×
                </button>
            </header>

            {input.draftSelection ? (
                <section className="comment-card-section">
                    <blockquote className="comments-quote">{input.draftSelection.quote}</blockquote>
                    <textarea
                        className="comments-textarea"
                        onChange={(event) => setComposerBody(event.target.value)}
                        placeholder="Add a comment"
                        rows={4}
                        value={composerBody}
                    />
                    {error ? <div className="comments-error">{error}</div> : null}
                    <div className="comments-actions">
                        <button
                            className="comments-btn comments-btn-primary"
                            onClick={() => {
                                const result = input.onCreateThread(composerBody)
                                if (!result.ok) {
                                    setError(result.error)
                                    return
                                }
                                setComposerBody('')
                                setError(null)
                            }}
                            type="button"
                        >
                            Add comment
                        </button>
                        <button className="comments-btn" onClick={input.onClose} type="button">
                            Cancel
                        </button>
                    </div>
                </section>
            ) : input.thread ? (
                <ThreadCard
                    error={error}
                    input={input}
                    onError={setError}
                    editingBody={editingBody}
                    editingMessageId={editingMessageId}
                    onEditingBody={setEditingBody}
                    onEditingMessageId={setEditingMessageId}
                    replyBody={replyBody}
                    onReplyBody={setReplyBody}
                />
            ) : null}
        </aside>
    )
}

function ThreadCard(input: {
    error: string | null
    input: Omit<Parameters<typeof TextCommentsPane>[0], 'draftSelection' | 'top' | 'containerHeight'>
    onError: (value: string | null) => void
    editingBody: string
    editingMessageId: string | null
    onEditingBody: (value: string) => void
    onEditingMessageId: (value: string | null) => void
    replyBody: string
    onReplyBody: (value: string) => void
}) {
    const thread = input.input.thread
    if (!thread) return null

    return (
        <section className="comment-card-section comment-card-thread">
            <div className="comment-card-thread-scroll">
                <blockquote className="comments-quote">{thread.quote}</blockquote>
                <div className="comments-thread-actions">
                    <button
                        className="comments-pane-link"
                        onClick={() => {
                            if (thread.status === 'resolved') input.input.onReopenThread(thread.id)
                            else input.input.onResolveThread(thread.id)
                        }}
                        type="button"
                    >
                        {thread.status === 'resolved' ? 'Reopen' : 'Resolve'}
                    </button>
                    {thread.canDelete ? (
                        <button
                            className="comments-pane-link danger"
                            onClick={() => {
                                const result = input.input.onDeleteThread(thread.id)
                                if (!result.ok) input.onError(result.error)
                            }}
                            type="button"
                        >
                            Delete thread
                        </button>
                    ) : null}
                </div>

                <div className="comment-card-body">
                    {thread.messages.map((message) => (
                        <article key={message.id} className="comments-message">
                            <div className="comments-message-meta">
                                <span style={{ color: message.author.textColor }}>{message.author.name}</span>
                                <span>{formatCommentTime(message.updatedAt)}</span>
                            </div>
                            {input.editingMessageId === message.id ? (
                                <>
                                    <textarea
                                        className="comments-textarea"
                                        onChange={(event) => input.onEditingBody(event.target.value)}
                                        rows={3}
                                        value={input.editingBody}
                                    />
                                    <div className="comments-actions">
                                        <button
                                            className="comments-btn comments-btn-primary"
                                            onClick={() => {
                                                const result = input.input.onEditMessage({
                                                    threadId: thread.id,
                                                    messageId: message.id,
                                                    body: input.editingBody,
                                                })
                                                if (!result.ok) {
                                                    input.onError(result.error)
                                                    return
                                                }
                                                input.onEditingBody('')
                                                input.onEditingMessageId(null)
                                                input.onError(null)
                                            }}
                                            type="button"
                                        >
                                            Save
                                        </button>
                                        <button
                                            className="comments-btn"
                                            onClick={() => {
                                                input.onEditingBody('')
                                                input.onEditingMessageId(null)
                                            }}
                                            type="button"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="comments-message-body">{message.body}</p>
                            )}
                            {input.editingMessageId !== message.id ? (
                                <div className="comments-message-actions">
                                    {message.canEdit ? (
                                        <button
                                            className="comments-pane-link"
                                            onClick={() => {
                                                input.onEditingBody(message.body)
                                                input.onEditingMessageId(message.id)
                                            }}
                                            type="button"
                                        >
                                            Edit
                                        </button>
                                    ) : null}
                                    {message.canDelete ? (
                                        <button
                                            className="comments-pane-link danger"
                                            onClick={() => {
                                                const result = input.input.onDeleteMessage({
                                                    threadId: thread.id,
                                                    messageId: message.id,
                                                })
                                                if (!result.ok) input.onError(result.error)
                                            }}
                                            type="button"
                                        >
                                            Delete
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                        </article>
                    ))}
                </div>

                <div className="comments-reply">
                    <textarea
                        className="comments-textarea"
                        onChange={(event) => input.onReplyBody(event.target.value)}
                        placeholder="Reply to thread"
                        rows={3}
                        value={input.replyBody}
                    />
                    {input.error ? <div className="comments-error">{input.error}</div> : null}
                    <div className="comments-actions">
                        <button
                            className="comments-btn comments-btn-primary"
                            onClick={() => {
                                const result = input.input.onReplyToThread({
                                    threadId: thread.id,
                                    body: input.replyBody,
                                })
                                if (!result.ok) {
                                    input.onError(result.error)
                                    return
                                }
                                input.onReplyBody('')
                                input.onError(null)
                            }}
                            type="button"
                        >
                            Reply
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}

function formatCommentTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value))
}
