import { type RefObject, useEffect } from 'react'

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
    const elements = root.querySelectorAll<HTMLElement>(
        '.landing-feature-cell, .landing-how-step',
    )
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry, index) => {
                if (!entry.isIntersecting) return
                ;(entry.target as HTMLElement).style.transitionDelay =
                    `${index * 70}ms`
                entry.target.classList.add('visible')
                observer.unobserve(entry.target)
            })
        },
        { threshold: 0.15 },
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
}

function setupParallax(root: HTMLElement) {
    const elements = root.querySelectorAll<HTMLElement>('[data-parallax]')
    const tilting = new WeakSet<Element>()
    let ticking = false

    function update() {
        elements.forEach((element) => {
            if (tilting.has(element)) return
            const speed = Number.parseFloat(element.dataset.parallax ?? '0')
            const baseY = Number.parseFloat(element.dataset.rotatey ?? '0')
            const rect = element.getBoundingClientRect()
            const offset =
                (rect.top + rect.height / 2 - window.innerHeight / 2) * speed
            element.style.transform = `rotateY(${baseY}deg) translateY(${offset}px)`
        })
        ticking = false
    }

    const onScroll = () => {
        if (ticking) return
        requestAnimationFrame(update)
        ticking = true
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    ;(root as { __landingTilting?: WeakSet<Element> }).__landingTilting =
        tilting
    return () => window.removeEventListener('scroll', onScroll)
}

function setupTilt(root: HTMLElement) {
    const elements = root.querySelectorAll<HTMLElement>(
        '.landing-hero-frame, .landing-features-shot-frame',
    )
    const tilting =
        (root as { __landingTilting?: WeakSet<Element> }).__landingTilting ??
        new WeakSet<Element>()
    const controllers: AbortController[] = []

    elements.forEach((element) => {
        const controller = new AbortController()
        controllers.push(controller)

        element.addEventListener(
            'mouseenter',
            () => {
                tilting.add(element)
                element.style.transition =
                    'transform 100ms ease-out, box-shadow 400ms ease'
            },
            { signal: controller.signal },
        )

        element.addEventListener(
            'mousemove',
            (event) => {
                const rect = element.getBoundingClientRect()
                const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2
                const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2

                element.style.transform = `rotateY(${nx * TILT_MAX}deg) rotateX(${-ny * TILT_MAX * 0.6}deg) scale(1.02)`
                element.style.boxShadow = [
                    '0 0 0 1px var(--stone-accent)',
                    '0 0 0 4px var(--stone-bg)',
                    '0 0 0 5px var(--stone-border-strong)',
                    `${-nx * 20}px ${ny * 20 + 16}px 48px var(--stone-landing-tilt-shadow-color)`,
                    '0 0 80px var(--stone-landing-tilt-glow)',
                ].join(', ')
                element.style.setProperty(
                    '--mouse-x',
                    `${((event.clientX - rect.left) / rect.width) * 100}%`,
                )
                element.style.setProperty(
                    '--mouse-y',
                    `${((event.clientY - rect.top) / rect.height) * 100}%`,
                )
            },
            { signal: controller.signal },
        )

        element.addEventListener(
            'mouseleave',
            () => {
                tilting.delete(element)
                const baseY = element.dataset.rotatey ?? '-6'
                element.style.transition =
                    'transform 500ms ease, box-shadow 500ms ease'
                element.style.transform = `rotateY(${baseY}deg)`
                element.style.boxShadow = ''
            },
            { signal: controller.signal },
        )
    })

    return () => controllers.forEach((controller) => controller.abort())
}
