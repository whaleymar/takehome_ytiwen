// Minimal DOM helpers for component tests, using React's own act/createRoot
// rather than React Testing Library. Test files using these need the jsdom
// environment (`// @vitest-environment jsdom`).
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mounted: (() => void)[] = []

afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

/** Renders into a fresh container; unmounted automatically after each test. */
export function mount(ui: ReactNode): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(ui))
  mounted.push(() => {
    act(() => root.unmount())
    container.remove()
  })
  return container
}

/** Lets pending promises (e.g. a mocked fetch) resolve and React re-render. */
export async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

/** Sets an input's value the way typing does, so React's onChange fires. */
export function type(input: HTMLInputElement, text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setValue.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

export function click(el: Element | null) {
  if (!el) throw new Error('click: element not found')
  act(() => (el as HTMLElement).click())
}

/** Dispatches a cancelable keydown and returns the event so callers can check defaultPrevented. */
export function keyDown(el: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => {
    el.dispatchEvent(event)
  })
  return event
}

/** The first element matching `selector` whose trimmed text is exactly `text`. */
export function byText<T extends Element = HTMLElement>(root: ParentNode, selector: string, text: string): T {
  const el = [...root.querySelectorAll<T>(selector)].find((e) => e.textContent?.trim() === text)
  if (!el) throw new Error(`No ${selector} with text "${text}"`)
  return el
}
