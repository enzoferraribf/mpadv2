import { useRef, useState, type FormEvent } from 'react'
import heroImg from '@/assets/landing-hero.png'
import featuresImg from '@/assets/landing-features.png'
import { useLandingPageModel } from '@/landing/model/use-landing-page-model'
import { useLandingEffects } from './use-landing-effects'

const FEATURES = [
    { idx: '01', name: 'Markdown', desc: 'Write in markdown with live split preview. Syntax highlighting, headings, lists, blockquotes.' },
    { idx: '02', name: 'Drawing', desc: 'One shared canvas per pad. Every stroke syncs in real time to every connected peer.' },
    { idx: '03', name: 'Live files', desc: 'Drop files into a pad. Everyone grabs them. No upload, no storage. Files live with the session.' },
    { idx: '04', name: 'Presence', desc: 'See who is editing. Cursors, names, connection status. You feel the collaboration.' },
    { idx: '05', name: 'Persistence', desc: 'Text and drawings auto-save. Come back later, everything is still there. No save button.' },
    { idx: '06', name: 'Pad trees', desc: 'Pads live at paths. Paths create natural hierarchy. Navigate related pads by structure.' },
] as const

const STEPS = [
    { num: '1', text: <><strong>Open a URL.</strong> Any path becomes a pad. No sign-up, no install, no waiting.</> },
    { num: '2', text: <><strong>Write and draw.</strong> Markdown on the left, preview on the right. Switch to the canvas to sketch.</> },
    { num: '3', text: <><strong>Share the link.</strong> Anyone with the URL joins instantly. You see their cursor, they see yours.</> },
    { num: '4', text: <><strong>Drop files.</strong> Drag a file in and everyone connected can download it. No cloud, no limits.</> },
] as const

export function LandingPage() {
    const ref = useRef<HTMLDivElement>(null)
    const model = useLandingPageModel()

    useLandingEffects(ref)

    return (
        <div ref={ref} data-testid="landing-page">
            <LandingNav host={model.host} onGo={model.openPad} />
            <LandingHero host={model.host} onGo={model.openPad} />
            <LandingStats />
            <LandingFeatures />
            <LandingHow />
            <LandingCTA host={model.host} onGo={model.openPad} />
            <LandingFooter />
        </div>
    )
}

function LandingPadInput(input: {
    autoFocus?: boolean
    host: string
    onGo: (name: string) => void
    placeholder: string
    variant: 'nav' | 'full'
}) {
    const [value, setValue] = useState('')

    function onSubmit(event: FormEvent) {
        event.preventDefault()
        input.onGo(value)
    }

    return (
        <form className={input.variant === 'nav' ? 'landing-nav-pad-input' : 'landing-pad-input'} onSubmit={onSubmit}>
            <span className="landing-pip-prefix">{input.host}/</span>
            <input
                autoComplete="off"
                autoFocus={input.autoFocus}
                onChange={(event) => setValue(event.target.value)}
                placeholder={input.placeholder}
                spellCheck={false}
                type="text"
                value={value}
            />
            <button type="submit" className="landing-pip-go" aria-label="Open pad">
                <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
        </form>
    )
}

function LandingNav(input: { host: string; onGo: (name: string) => void }) {
    return (
        <nav className="landing-nav">
            <div className="landing-nav-left">
                <a href="/" className="landing-nav-wordmark"><span className="landing-nav-logo-m">M</span>PAD</a>
                <div className="landing-nav-sep" />
                <div className="landing-nav-label">real-time collaborative pad</div>
            </div>
            <div className="landing-nav-right">
                <a href="#features" className="landing-nav-link">Features</a>
                <LandingPadInput host={input.host} onGo={input.onGo} placeholder="pad-name" variant="nav" />
            </div>
        </nav>
    )
}

function LandingHero(input: { host: string; onGo: (name: string) => void }) {
    return (
        <section className="landing-hero">
            <div className="landing-hero-text">
                <div className="landing-hero-super">// Real-time collaboration</div>
                <h1 className="landing-hero-h1">Write.<br />Draw.<br /><span>Share.</span></h1>
                <p className="landing-hero-desc">A real-time collaborative pad for markdown, drawing, and file sharing. No accounts, no friction. Open a URL and start.</p>
                <div className="landing-hero-actions">
                    <LandingPadInput autoFocus host={input.host} onGo={input.onGo} placeholder="your-pad-name" variant="full" />
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

function LandingFeatures() {
    return (
        <section className="landing-features-section" id="features">
            <div className="landing-features-header">
                <div className="landing-features-title">Everything in the pad</div>
                <div className="landing-features-sub">Core features</div>
            </div>
            <div className="landing-features-body">
                <div className="landing-features-grid">
                    {FEATURES.map((feature) => (
                        <div key={feature.idx} className="landing-feature-cell">
                            <div className="landing-feature-idx">{feature.idx}</div>
                            <div className="landing-feature-name">{feature.name}</div>
                            <div className="landing-feature-desc">{feature.desc}</div>
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

function LandingHow() {
    return (
        <section className="landing-how">
            <div className="landing-how-inner">
                <div className="landing-how-label">How it works</div>
                <div className="landing-how-steps">
                    {STEPS.map((step) => (
                        <div key={step.num} className="landing-how-step">
                            <div className="landing-how-num">{step.num}</div>
                            <div className="landing-how-text">{step.text}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function LandingCTA(input: { host: string; onGo: (name: string) => void }) {
    return (
        <section className="landing-cta">
            <h2 className="landing-cta-h2">Open. Write. <span>Done.</span></h2>
            <p className="landing-cta-p">Name your pad and go.</p>
            <LandingPadInput host={input.host} onGo={input.onGo} placeholder="meeting-notes" variant="full" />
            <div className="landing-pad-input-hint">Press <kbd>Enter</kbd> to open</div>
        </section>
    )
}

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
