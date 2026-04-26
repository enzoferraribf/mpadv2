const fallbackLines = Array.from(
    { length: 12 },
    (_, index) => `text-line-${index}`,
)

export function TextLoadingSkeleton() {
    return (
        <div className='text-loader-grid'>
            <div className='text-loader-pane'>
                {fallbackLines.map((line, index) => (
                    <div
                        className={`lazy-line ${index % 3 === 0 ? 'wide' : ''}`}
                        key={line}
                    />
                ))}
            </div>
        </div>
    )
}
