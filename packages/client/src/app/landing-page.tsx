import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { padPath } from '@mmpad/shared'
import { useLandingEffects } from '@/hooks/use-landing-effects'
import heroImg from '@/assets/landing-hero.png'
import featuresImg from '@/assets/landing-features.png'

export function LandingPage() {
    const pageRef = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const host = useMemo(() => window.location.host, [])

    useEffect(() => {
        document.title = 'MPAD'
    }, [])

    useLandingEffects(pageRef)

    const goToPad = (name: string) => {
        if (!name.trim()) return
        navigate({ to: '/$', params: { _splat: padPath(name.trim()).slice(1) } })
    }

    return (
        <div ref={pageRef}>
            <LandingNav host={host} onGo={goToPad} />
            <LandingHero host={host} onGo={goToPad} />
            <LandingStats />
            <LandingFeatures />
            <LandingHow />
            <LandingCTA host={host} onGo={goToPad} />
            <LandingFooter />
        </div>
    )
}

/* ---- Shared pad input ---- */

function PadInput(input: {
    host: string
    onGo: (name: string) => void
    variant: 'nav' | 'full'
    placeholder?: string
    autoFocus?: boolean
}) {
    const [value, setValue] = useState('')
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        input.onGo(value)
    }

    return (
        <form className={input.variant === 'nav' ? 'landing-nav-pad-input' : 'landing-pad-input'} onSubmit={handleSubmit}>
            <span className="landing-pip-prefix">{input.host}/</span>
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={input.placeholder ?? 'pad-name'}
                spellCheck={false}
                autoComplete="off"
                autoFocus={input.autoFocus}
            />
            <button type="submit" className="landing-pip-go" aria-label="Open pad">
                <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
        </form>
    )
}

/* ---- Nav ---- */

function LandingNav(props: { host: string; onGo: (name: string) => void }) {
    return (
        <nav className="landing-nav">
            <div className="landing-nav-left">
                <a href="/" className="landing-nav-wordmark"><span className="landing-nav-logo-m">M</span>PAD</a>
                <div className="landing-nav-sep" />
                <div className="landing-nav-label">real-time collaborative pad</div>
            </div>
            <div className="landing-nav-right">
                <a href="#features" className="landing-nav-link">Features</a>
                <PadInput host={props.host} onGo={props.onGo} variant="nav" />
            </div>
        </nav>
    )
}

/* ---- Hero ---- */

function LandingHero(props: { host: string; onGo: (name: string) => void }) {
    return (
        <section className="landing-hero">
            <div className="landing-hero-text">
                <div className="landing-hero-super">// Real-time collaboration</div>
                <h1 className="landing-hero-h1">Write.<br />Draw.<br /><span>Share.</span></h1>
                <p className="landing-hero-desc">A real-time collaborative pad for markdown, drawing, and file sharing. No accounts, no friction. Open a URL and start.</p>
                <div className="landing-hero-actions">
                    <PadInput host={props.host} onGo={props.onGo} variant="full" placeholder="your-pad-name" autoFocus />
                    <div className="landing-pad-input-hint">Press <kbd>Enter</kbd> to open</div>
                </div>
                <a href="#features" className="landing-hero-secondary">See features</a>
            </div>
            <div className="landing-hero-image">
                <div className="landing-hero-frame" data-parallax="0.12" data-rotatey="-6">
                    <img src={heroImg} alt="MPAD editor" />
                </div>
            </div>
        </section>
    )
}

/* ---- Stats ---- */

function LandingStats() {
    return (
        <section className="landing-stats">
            <div className="landing-stat">
                <div className="landing-stat-value">0</div>
                <div className="landing-stat-label">Accounts needed</div>
            </div>
            <div className="landing-stat">
                <div className="landing-stat-value">&infin;</div>
                <div className="landing-stat-label">Pads</div>
            </div>
            <div className="landing-stat">
                <div className="landing-stat-value">P2P</div>
                <div className="landing-stat-label">File sharing</div>
            </div>
            <div className="landing-stat">
                <div className="landing-stat-value">Live</div>
                <div className="landing-stat-label">Sync</div>
            </div>
        </section>
    )
}

/* ---- Features ---- */

const FEATURES = [
    { idx: '01', name: 'Markdown', desc: 'Write in markdown with live split preview. Syntax highlighting, headings, lists, blockquotes.' },
    { idx: '02', name: 'Drawing', desc: 'One shared canvas per pad. Every stroke syncs in real time to every connected peer.' },
    { idx: '03', name: 'Live files', desc: 'Drop files into a pad. Everyone grabs them. No upload, no storage. Files live with the session.' },
    { idx: '04', name: 'Presence', desc: 'See who\'s editing. Cursors, names, connection status. You feel the collaboration.' },
    { idx: '05', name: 'Persistence', desc: 'Text and drawings auto-save. Come back later, everything is still there. No save button.' },
    { idx: '06', name: 'Pad trees', desc: 'Pads live at paths. Paths create natural hierarchy. Navigate related pads by structure.' },
] as const

function LandingFeatures() {
    return (
        <section className="landing-features-section" id="features">
            <div className="landing-features-header">
                <div className="landing-features-title">Everything in the pad</div>
                <div className="landing-features-sub">Core features</div>
            </div>
            <div className="landing-features-body">
                <div className="landing-features-grid">
                    {FEATURES.map((f) => (
                        <div key={f.idx} className="landing-feature-cell">
                            <div className="landing-feature-idx">{f.idx}</div>
                            <div className="landing-feature-name">{f.name}</div>
                            <div className="landing-feature-desc">{f.desc}</div>
                        </div>
                    ))}
                </div>
                <div className="landing-features-shot">
                    <div className="landing-features-shot-frame" data-parallax="0.08" data-rotatey="-5">
                        <img src={featuresImg} alt="MPAD files view" />
                    </div>
                    <div className="landing-features-shot-caption">File sharing view</div>
                </div>
            </div>
        </section>
    )
}

/* ---- How it works ---- */

const STEPS = [
    { num: '1', text: <><strong>Open a URL.</strong> Any path becomes a pad. No sign-up, no install, no waiting.</> },
    { num: '2', text: <><strong>Write and draw.</strong> Markdown on the left, preview on the right. Switch to the canvas to sketch.</> },
    { num: '3', text: <><strong>Share the link.</strong> Anyone with the URL joins instantly. You see their cursor, they see yours.</> },
    { num: '4', text: <><strong>Drop files.</strong> Drag a file in and everyone connected can download it. No cloud, no limits.</> },
] as const

function LandingHow() {
    return (
        <section className="landing-how">
            <div className="landing-how-inner">
                <div className="landing-how-label">How it works</div>
                <div className="landing-how-steps">
                    {STEPS.map((s) => (
                        <div key={s.num} className="landing-how-step">
                            <div className="landing-how-num">{s.num}</div>
                            <div className="landing-how-text">{s.text}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

/* ---- Bottom CTA ---- */

function LandingCTA(props: { host: string; onGo: (name: string) => void }) {
    return (
        <section className="landing-cta">
            <h2 className="landing-cta-h2">Open. Write. <span>Done.</span></h2>
            <p className="landing-cta-p">Name your pad and go.</p>
            <PadInput host={props.host} onGo={props.onGo} variant="full" placeholder="meeting-notes" />
            <div className="landing-pad-input-hint">Press <kbd>Enter</kbd> to open</div>
        </section>
    )
}

/* ---- Footer ---- */

function LandingFooter() {
    return (
        <footer className="landing-footer">
            <div className="landing-footer-left"><span className="landing-nav-logo-m">M</span>PAD</div>
            <div className="landing-footer-center">real-time collaborative pad</div>
            <div className="landing-footer-right">
                <a href="#">GitHub</a>
                <a href="#">About</a>
            </div>
        </footer>
    )
}
