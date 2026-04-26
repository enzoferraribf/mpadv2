import { StateEffect, type Range } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

const remoteSelectionChanged = StateEffect.define<void>()

export function createRemoteSelectionLineExtension(
    ytext: Y.Text,
    awareness: Awareness,
) {
    return ViewPlugin.define(
        (view) => {
            const listener = () =>
                queueMicrotask(() => {
                    if (!view.state) return
                    view.dispatch({ effects: remoteSelectionChanged.of() })
                })
            const plugin = {
                decorations: Decoration.none,
                update(update: ViewUpdate) {
                    if (
                        update.docChanged ||
                        update.viewportChanged ||
                        update.transactions.some((transaction) =>
                            transaction.effects.some((effect) =>
                                effect.is(remoteSelectionChanged),
                            ),
                        )
                    ) {
                        this.decorations = buildLineSelections(
                            update.view,
                            ytext,
                            awareness,
                        )
                    }
                },
                destroy() {
                    awareness.off('change', listener)
                },
            }

            awareness.on('change', listener)
            plugin.decorations = buildLineSelections(view, ytext, awareness)
            return plugin
        },
        {
            decorations: (plugin) => plugin.decorations,
        },
    )
}

function buildLineSelections(
    view: EditorView,
    ytext: Y.Text,
    awareness: Awareness,
) {
    const ydoc = ytext.doc
    if (!ydoc) return Decoration.none

    const decorations: Range<Decoration>[] = []

    for (const [clientId, state] of awareness.getStates()) {
        if (clientId === awareness.doc.clientID || !isRecord(state)) continue
        if (!isRecord(state.cursor)) continue

        const anchor = readPosition(state.cursor.anchor, ydoc, ytext)
        const head = readPosition(state.cursor.head, ydoc, ytext)
        if (anchor === null || head === null) continue

        const start = Math.min(anchor, head)
        const end = Math.max(anchor, head)
        const startLine = view.state.doc.lineAt(start)
        const endLine = view.state.doc.lineAt(end)

        if (startLine.number === endLine.number) continue

        const color = readSelectionColor(state.user)
        for (
            let lineNumber = startLine.number + 1;
            lineNumber < endLine.number;
            lineNumber++
        ) {
            const line = view.state.doc.line(lineNumber)
            if (line.from === line.to) continue
            decorations.push(
                Decoration.mark({
                    attributes: { style: `background-color: ${color}` },
                    class: 'cm-ySelection',
                }).range(line.from, line.to),
            )
        }
    }

    return Decoration.set(decorations, true)
}

function readPosition(value: unknown, doc: Y.Doc, ytext: Y.Text) {
    if (!isRecord(value)) return null
    const position = Y.createAbsolutePositionFromRelativePosition(
        Y.createRelativePositionFromJSON(value),
        doc,
    )
    if (!position || position.type !== ytext) return null
    return position.index
}

function readSelectionColor(value: unknown) {
    if (!isRecord(value)) return '#30bced33'
    if (typeof value.colorLight === 'string') return value.colorLight
    if (typeof value.color === 'string') return `${value.color}33`
    return '#30bced33'
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}
