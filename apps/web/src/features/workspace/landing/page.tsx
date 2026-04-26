import { useLandingPageModel } from '@/features/workspace/landing/model'
import { type FormEvent, useEffect, useId, useState } from 'react'

type LandingPadInputProps = {
    autoFocus?: boolean
    host: string
    onGo: (name: string) => void
}

export function LandingPage() {
    const model = useLandingPageModel()

    useEffect(() => {
        document.title = 'MPAD'
    }, [])

    return (
        <main data-testid='landing-page' className='landing'>
            <div className='landing-main'>
                <header className='landing-copy'>
                    <h1 className='landing-title' aria-label='MPAD'>
                        <span className='mpad-logo landing-wordmark'>
                            <span className='mpad-logo-m'>M</span>PAD
                        </span>
                    </h1>
                    <p className='landing-tagline'>
                        markdown, drawing, live files, related pads
                    </p>
                </header>
                <LandingPadInput
                    autoFocus
                    host={model.host}
                    onGo={model.openPad}
                />
            </div>
        </main>
    )
}

function LandingPadInput(input: LandingPadInputProps) {
    const [value, setValue] = useState('')
    const inputId = useId()

    function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        input.onGo(value)
    }

    return (
        <form className='landing-pad-input' onSubmit={onSubmit}>
            <label className='sr-only' htmlFor={inputId}>
                Pad path
            </label>
            <span
                className='landing-pip-prefix'
                aria-hidden='true'
                title={`${input.host}/`}
            >
                {input.host}/
            </span>
            <input
                id={inputId}
                autoCapitalize='off'
                autoComplete='off'
                autoCorrect='off'
                autoFocus={input.autoFocus}
                name='path'
                onChange={(event) => setValue(event.target.value)}
                placeholder='your-pad-name'
                spellCheck={false}
                type='text'
                value={value}
            />
            <button
                type='submit'
                className='landing-pip-go'
                aria-label='Open pad'
            >
                <svg viewBox='0 0 24 24'>
                    <path d='M5 12h14M13 6l6 6-6 6' />
                </svg>
            </button>
        </form>
    )
}
