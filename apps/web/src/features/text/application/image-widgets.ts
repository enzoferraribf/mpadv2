import { sanitizeMarkdownMediaSource } from '@/features/text/domain/media'
import {
    Decoration,
    type DecorationSet,
    type EditorView,
    ViewPlugin,
    type ViewUpdate,
    WidgetType,
} from '@codemirror/view'

const standaloneImagePattern = /^\s*!\[([^\]]*)\]\((.+)\)\s*$/

type StandaloneImage = {
    alt: string
    markup: string
    src: string
}

class MarkdownImageWidget extends WidgetType {
    constructor(private readonly image: StandaloneImage) {
        super()
    }

    eq(other: MarkdownImageWidget) {
        return other.image.markup === this.image.markup
    }

    toDOM() {
        const root = document.createElement('div')
        root.className = 'cm-editor-image'
        root.dataset.editorImageWidget = 'true'

        const image = document.createElement('img')
        image.alt = this.image.alt
        image.decoding = 'async'
        image.draggable = false
        image.loading = 'lazy'
        image.src = this.image.src

        const fallback = document.createElement('div')
        fallback.className = 'cm-editor-image-fallback'
        fallback.hidden = true
        fallback.textContent = this.image.markup

        image.addEventListener(
            'error',
            () => {
                image.remove()
                fallback.hidden = false
            },
            { once: true },
        )

        root.append(image, fallback)
        return root
    }

    ignoreEvent() {
        return false
    }
}

export function createMarkdownImageWidgetExtension() {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet

            constructor(view: EditorView) {
                this.decorations = buildDecorations(view)
            }

            update(update: ViewUpdate) {
                if (
                    !update.docChanged &&
                    !update.selectionSet &&
                    !update.viewportChanged
                ) {
                    return
                }
                this.decorations = buildDecorations(update.view)
            }
        },
        {
            decorations: (plugin) => plugin.decorations,
        },
    )
}

function buildDecorations(view: EditorView) {
    const decorations = []

    for (const range of view.visibleRanges) {
        let position = range.from
        while (position <= range.to) {
            const line = view.state.doc.lineAt(position)
            const image = readStandaloneImage(line.text)
            if (
                image &&
                !selectionTouchesLine(view.state.selection, line.from, line.to)
            ) {
                decorations.push(
                    Decoration.replace({
                        widget: new MarkdownImageWidget(image),
                    }).range(line.from, line.to),
                )
            }

            if (line.to >= range.to) break
            position = line.to + 1
        }
    }

    return Decoration.set(decorations, true)
}

function selectionTouchesLine(
    selection: EditorView['state']['selection'],
    from: number,
    to: number,
) {
    for (const range of selection.ranges) {
        if (range.empty) {
            if (range.from >= from && range.from <= to) return true
            continue
        }

        if (range.from <= to && range.to >= from) return true
    }

    return false
}

function readStandaloneImage(line: string): StandaloneImage | null {
    const match = standaloneImagePattern.exec(line)
    if (!match) return null

    const alt = match[1] ?? ''
    const rawSrc = match[2]?.trim()
    if (!rawSrc) return null
    const src = sanitizeMarkdownMediaSource(rawSrc)
    if (!src) return null

    return {
        alt,
        markup: line,
        src,
    }
}
