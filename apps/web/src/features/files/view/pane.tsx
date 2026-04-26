import { FileTransferProgress } from '@/features/files/view/progress'
import type { LiveFileState } from '@mpad/protocol/live-files'
import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { formatFileSize } from './format'

export function FilesPane(input: {
    files: LiveFileState[]
    onDeleteFile: (id: string) => void
    onDownloadFile: (file: LiveFileState) => void
    onUploadFile: (file: File) => void
}) {
    const [dragging, setDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    return (
        <section
            className={`files-pane workspace-shell min-h-0${dragging ? ' dragging' : ''}`}
            onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) =>
                handleDrop(event, input.onUploadFile, setDragging)
            }
            data-testid='workspace-shell'
        >
            <input
                ref={fileInputRef}
                type='file'
                className='hidden'
                onChange={() =>
                    handleFileSelect(fileInputRef.current, input.onUploadFile)
                }
            />
            {input.files.length === 0 ? (
                <div
                    className='files-empty'
                    role='button'
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                >
                    Tap or drop files to share
                </div>
            ) : (
                <div className='files-grid'>
                    {input.files.map((file) => (
                        <div
                            key={file.meta.id}
                            className='files-card'
                            role='button'
                            tabIndex={0}
                            onClick={() => input.onDownloadFile(file)}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ')
                                    return
                                event.preventDefault()
                                input.onDownloadFile(file)
                            }}
                        >
                            <div className='files-card-icon'>&#x1F4C4;</div>
                            <div
                                className='files-card-name'
                                title={file.meta.name}
                            >
                                {file.meta.name}
                            </div>
                            <div className='files-card-size'>
                                {formatFileSize(file.meta.sizeBytes)}
                            </div>
                            <FileTransferProgress file={file} compact />
                            {file.isLocal ? (
                                <button
                                    className='files-card-delete'
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        input.onDeleteFile(file.meta.id)
                                    }}
                                    title='Remove'
                                >
                                    &times;
                                </button>
                            ) : null}
                        </div>
                    ))}
                    <button
                        className='files-card files-card-add'
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className='files-card-icon'>&#x2B;</div>
                        <div className='files-card-name'>Add file</div>
                    </button>
                </div>
            )}
        </section>
    )
}

function handleDrop(
    event: DragEvent,
    onUploadFile: (file: File) => void,
    setDragging: (dragging: boolean) => void,
) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onUploadFile(file)
}

function handleFileSelect(
    input: HTMLInputElement | null,
    onUploadFile: (file: File) => void,
) {
    const file = input?.files?.[0]
    if (file) onUploadFile(file)
    if (input) input.value = ''
}
