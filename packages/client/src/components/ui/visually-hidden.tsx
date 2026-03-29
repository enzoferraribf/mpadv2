import * as React from 'react'

export const VisuallyHidden = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
    (props, ref) => (
        <span
            ref={ref}
            className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]"
            {...props}
        />
    ),
)
VisuallyHidden.displayName = 'VisuallyHidden'
