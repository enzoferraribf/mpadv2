import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { padPath } from '@mmpad/shared'

export const Route = createFileRoute('/')({
    component: LandingPage,
})

function LandingPage() {
    const [padName, setPadName] = useState('')
    const navigate = useNavigate()
    const host = useMemo(() => window.location.host, [])

    useEffect(() => {
        document.title = 'Mpad'
    }, [])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!padName.trim()) return
        navigate({ to: '/$', params: { _splat: padPath(padName.trim()).slice(1) } })
    }

    return (
        <main className="landing-shell" data-testid="landing-page">
            <div className="landing-page">
                <section className="landing-hero">
                    <span className="mpad-logo mpad-logo-lg"><span className="mpad-logo-m">M</span>PAD</span>
                    <h1 className="landing-headline">Real-time collaborative documents</h1>
                    <p className="landing-tagline">Markdown editor, shared drawing, peer-to-peer files. No signup required.</p>

                    <form onSubmit={handleSubmit} className="slug-form">
                        <span className="slug-prefix">{host}/</span>
                        <div className="slug-field">
                            <input
                                type="text"
                                value={padName}
                                onChange={(event) => setPadName(event.target.value)}
                                placeholder="pad-name"
                                className="slug-input"
                                autoFocus
                            />
                        </div>
                        <button type="submit" className="slug-submit" disabled={!padName.trim()} aria-label="Open pad">
                            <ArrowUpRight className="h-4 w-4" />
                        </button>
                    </form>
                </section>

                <section className="landing-features">
                    <div className="landing-feature">
                        <span className="landing-feature-icon">&#x270E;</span>
                        <h3 className="landing-feature-title">Markdown Editor</h3>
                        <p className="landing-feature-desc">Write together in real-time with live preview, syntax highlighting, and collaborative cursors.</p>
                    </div>
                    <div className="landing-feature">
                        <span className="landing-feature-icon">&#x25C9;</span>
                        <h3 className="landing-feature-title">Shared Drawing</h3>
                        <p className="landing-feature-desc">Excalidraw canvas synced between all connected peers. Sketch ideas together.</p>
                    </div>
                    <div className="landing-feature">
                        <span className="landing-feature-icon">&#x21D7;</span>
                        <h3 className="landing-feature-title">Live Files</h3>
                        <p className="landing-feature-desc">Drag and drop files to share peer-to-peer. No server storage, files stay with you.</p>
                    </div>
                </section>

                <footer className="landing-footer">
                    Open source &middot; No accounts &middot; Text persists &middot; Files stay with peers
                </footer>
            </div>
        </main>
    )
}
