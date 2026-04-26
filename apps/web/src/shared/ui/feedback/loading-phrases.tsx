const PHRASES = [
    'Warming up the markdown...',
    'Connecting the dots...',
    'Preparing your canvas...',
    'Loading the good stuff...',
    'Almost there...',
]

export function getRandomPhrase() {
    return PHRASES[Math.floor(Math.random() * PHRASES.length)]!
}
