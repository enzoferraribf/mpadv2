import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

type LoadableComponent<T extends ComponentType<any>> = LazyExoticComponent<T> & {
    preload: () => Promise<{ default: T }>
}

export function lazyWithPreload<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
    let promise: Promise<{ default: T }> | null = null

    const load = () => {
        promise ??= factory()
        return promise
    }

    const Component = lazy(load) as LoadableComponent<T>
    Component.preload = load

    return Component
}
