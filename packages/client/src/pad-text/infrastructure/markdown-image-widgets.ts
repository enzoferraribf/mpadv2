import { StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'

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

        image.addEventListener('error', () => {
            image.remove()
            fallback.hidden = false
        }, { once: true })

        root.append(image, fallback)
        return root
    }

    ignoreEvent() {
        return false
    }
}

export function createMarkdownImageWidgetExtension() {
    return StateField.define<DecorationSet>({
        create(state) {
            return buildDecorations(state)
        },
        update(value, transaction) {
            if (!transaction.docChanged && !transaction.selection) return value
            return buildDecorations(transaction.state)
        },
        provide(field) {
            return EditorView.decorations.from(field)
        },
    })
}

function buildDecorations(state: EditorView['state']) {
    const decorations = []

    for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
        const line = state.doc.line(lineNumber)
        const image = readStandaloneImage(line.text)
        if (!image || selectionTouchesLine(state.selection, line.from, line.to)) continue

        decorations.push(Decoration.replace({
            widget: new MarkdownImageWidget(image),
        }).range(line.from, line.to))
    }

    return Decoration.set(decorations, true)
}

function selectionTouchesLine(selection: EditorView['state']['selection'], from: number, to: number) {
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

    return {
        alt,
        markup: line,
        src: normalizeImageSource(rawSrc),
    }
}

function normalizeImageSource(value: string) {
    if (value.startsWith('<') && value.endsWith('>')) return value.slice(1, -1)
    return value
}
