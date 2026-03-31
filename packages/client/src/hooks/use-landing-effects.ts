import { useEffect, type RefObject } from 'react'

const TILT_MAX = 12

export function useLandingEffects(ref: RefObject<HTMLDivElement | null>) {
    useEffect(() => {
        const root = ref.current
        if (!root) return

        const html = document.documentElement
        const prevScroll = html.style.scrollBehavior
        const prevOverflow = document.body.style.overflowX
        html.style.scrollBehavior = 'smooth'
        document.body.style.overflowX = 'hidden'

        const revealCleanup = setupScrollReveal(root)
        const parallaxCleanup = setupParallax(root)
        const tiltCleanup = setupTilt(root)

        return () => {
            html.style.scrollBehavior = prevScroll
            document.body.style.overflowX = prevOverflow
            revealCleanup()
            parallaxCleanup()
            tiltCleanup()
        }
    }, [ref])
}

function setupScrollReveal(root: HTMLElement) {
    const elements = root.querySelectorAll<HTMLElement>('.landing-feature-cell, .landing-how-step')
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry, i) => {
                if (!entry.isIntersecting) return
                ;(entry.target as HTMLElement).style.transitionDelay = `${i * 70}ms`
                entry.target.classList.add('visible')
                observer.unobserve(entry.target)
            })
        },
        { threshold: 0.15 },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
}

function setupParallax(root: HTMLElement) {
    const elements = root.querySelectorAll<HTMLElement>('[data-parallax]')
    const tilting = new WeakSet<Element>()
    let ticking = false

    function update() {
        elements.forEach((el) => {
            if (tilting.has(el)) return
            const speed = parseFloat(el.dataset.parallax ?? '0')
            const baseY = parseFloat(el.dataset.rotatey ?? '0')
            const rect = el.getBoundingClientRect()
            const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed
            el.style.transform = `rotateY(${baseY}deg) translateY(${offset}px)`
        })
        ticking = false
    }

    const onScroll = () => {
        if (!ticking) {
            requestAnimationFrame(update)
            ticking = true
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()

    // Expose tilting set for tilt system
    ;(root as any).__landingTilting = tilting
    return () => window.removeEventListener('scroll', onScroll)
}

function setupTilt(root: HTMLElement) {
    const elements = root.querySelectorAll<HTMLElement>('.landing-hero-frame, .landing-features-shot-frame')
    const tilting: WeakSet<Element> = (root as any).__landingTilting ?? new WeakSet()
    const controllers: AbortController[] = []

    elements.forEach((el) => {
        const ac = new AbortController()
        controllers.push(ac)

        el.addEventListener(
            'mouseenter',
            () => {
                tilting.add(el)
                el.style.transition = 'transform 100ms ease-out, box-shadow 400ms ease'
            },
            { signal: ac.signal },
        )

        el.addEventListener(
            'mousemove',
            (e) => {
                const rect = el.getBoundingClientRect()
                const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2
                const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2

                el.style.transform = `rotateY(${nx * TILT_MAX}deg) rotateX(${-ny * TILT_MAX * 0.6}deg) scale(1.02)`
                el.style.boxShadow = [
                    '0 0 0 1px var(--stone-accent)',
                    '0 0 0 4px var(--stone-bg)',
                    '0 0 0 5px var(--stone-border-strong)',
                    `${-nx * 20}px ${ny * 20 + 16}px 48px rgba(0,0,0,0.5)`,
                    '0 0 80px rgba(201,168,124,0.1)',
                ].join(', ')
                el.style.setProperty('--mouse-x', `${((e.clientX - rect.left) / rect.width) * 100}%`)
                el.style.setProperty('--mouse-y', `${((e.clientY - rect.top) / rect.height) * 100}%`)
            },
            { signal: ac.signal },
        )

        el.addEventListener(
            'mouseleave',
            () => {
                tilting.delete(el)
                const baseY = el.dataset.rotatey ?? '-6'
                el.style.transition = 'transform 500ms ease, box-shadow 500ms ease'
                el.style.transform = `rotateY(${baseY}deg)`
                el.style.boxShadow = ''
            },
            { signal: ac.signal },
        )
    })

    return () => controllers.forEach((ac) => ac.abort())
}
