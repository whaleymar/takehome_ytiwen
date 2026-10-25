// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/programs.json'
import App from './App'
import { byText, click, flush, mount, type } from './test/dom'

const MIDWEST = 'midwest-business-finance--504-loan'
const ATLAS = 'atlas-financial-services--sba-express'
const PACIFIC = 'pacific-commerce-bank--7-a-small-loan'

function stubFetch(response: Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(() => response))
}

/** Mounts App at the given URL with the fixture as the API response, and waits for it to load. */
async function load(search = '') {
  window.history.replaceState(null, '', `/${search}`)
  stubFetch(Promise.resolve({ ok: true, json: () => Promise.resolve(fixture) }))
  const root = mount(<App />)
  await flush()
  return root
}

const count = (root: HTMLElement) => root.querySelector('.count')!.textContent
const checkbox = (root: HTMLElement, id: string) => root.querySelector<HTMLInputElement>(`#${id} input[type="checkbox"]`)!
const input = (root: HTMLElement, placeholder: string) => root.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)!

beforeEach(() => {
  window.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('shows a loading message until programs arrive', () => {
    window.history.replaceState(null, '', '/')
    stubFetch(new Promise(() => {}))
    expect(mount(<App />).textContent).toContain('Loading programs…')
  })

  it('shows an error when programs fail to load', async () => {
    window.history.replaceState(null, '', '/')
    stubFetch(Promise.resolve({ ok: false, status: 500 }))
    const root = mount(<App />)
    await flush()
    expect(root.textContent).toContain('Failed to load programs (500). Is the API server running?')
    expect(root.textContent).not.toContain('Loading programs')
  })

  it('renders every program with no filters', async () => {
    const root = await load()
    expect(count(root)).toBe('49 of 49 programs match')
  })

  it('applies filters from the URL', async () => {
    const root = await load('?amount=250000&business=Restaurant%2FFood+Service&years=2&tier=good')
    expect(count(root)).toBe('22 of 49 programs match')
    expect(input(root, 'e.g. 250k').value).toBe('250000')
    expect(root.querySelector('select')!.value).toBe('Restaurant/Food Service')
  })

  describe('cleaning stale or hand-edited links', () => {
    it('drops an unknown business type instead of silently filtering', async () => {
      const root = await load('?business=Bakery')
      expect(count(root)).toBe('49 of 49 programs match')
      expect(root.querySelector('select')!.value).toBe('')
      expect(window.location.search).toBe('')
    })

    it('fixes the case of a known business type', async () => {
      const root = await load('?business=manufacturing')
      expect(root.querySelector('select')!.value).toBe('Manufacturing')
      expect(window.location.search).toBe('?business=Manufacturing')
    })

    it('drops an unknown program type instead of showing zero results', async () => {
      const root = await load('?program=7a')
      expect(count(root)).toBe('49 of 49 programs match')
      expect(window.location.search).toBe('')
    })

    it('drops compare ids that are not in the data so they do not fill the comparison', async () => {
      const root = await load(`?compare=gone&compare=${MIDWEST}&compare=${ATLAS}`)
      expect(window.location.search).toBe(`?compare=${MIDWEST}&compare=${ATLAS}`)
      expect([...root.querySelectorAll('.compare-tray-item strong')].map((e) => e.textContent)).toEqual([
        'Midwest Business Finance',
        'Atlas Financial Services',
      ])
      expect(root.querySelectorAll('.compare-toggle input:disabled')).toHaveLength(0)
      click(checkbox(root, PACIFIC))
      expect(root.querySelectorAll('.compare-tray-item')).toHaveLength(3)
    })

    it('falls back to the list when a linked comparison has fewer than 2 known programs', async () => {
      const root = await load(`?compare=gone&compare=${MIDWEST}&view=compare`)
      expect(root.querySelector('.comparison')).toBeNull()
      expect(window.location.search).toBe(`?compare=${MIDWEST}`)
      // Ticking another program on the list must not jump into the comparison.
      click(checkbox(root, ATLAS))
      expect(root.querySelector('.comparison')).toBeNull()
    })
  })

  describe('history', () => {
    it('replaces history for filter edits and ticking Compare', async () => {
      const root = await load()
      const push = vi.spyOn(window.history, 'pushState')
      const replace = vi.spyOn(window.history, 'replaceState')

      type(input(root, 'e.g. 250k'), '250k')
      click(checkbox(root, MIDWEST))

      expect(push).not.toHaveBeenCalled()
      expect(replace).toHaveBeenCalledTimes(2)
      expect(window.location.search).toBe(`?amount=250000&compare=${MIDWEST}`)
    })

    it('pushes history when expanding a card', async () => {
      const root = await load()
      const push = vi.spyOn(window.history, 'pushState')
      click(root.querySelector(`#${MIDWEST} .card-summary`))
      expect(push).toHaveBeenCalledTimes(1)
      expect(window.location.search).toBe(`?open=${MIDWEST}`)
    })

    it('pushes history entering and leaving the comparison, including removing down to one', async () => {
      const root = await load(`?compare=${MIDWEST}&compare=${ATLAS}`)
      const push = vi.spyOn(window.history, 'pushState')

      click(root.querySelector('.compare-tray .primary-button'))
      expect(root.querySelector('.comparison')).not.toBeNull()
      expect(push).toHaveBeenCalledTimes(1)

      click(root.querySelector('.comparison .remove-button'))
      expect(root.querySelector('.comparison')).toBeNull()
      expect(push).toHaveBeenCalledTimes(2)
      expect(window.location.search).toBe(`?compare=${ATLAS}`)
    })

    it('restores state from the URL on Back/Forward and resets typed text', async () => {
      const root = await load()
      type(input(root, 'e.g. 2'), 'two')

      act(() => {
        window.history.pushState(null, '', `/?amount=100000&compare=${MIDWEST}&compare=${ATLAS}&view=compare`)
        window.dispatchEvent(new PopStateEvent('popstate'))
      })

      expect(input(root, 'e.g. 250k').value).toBe('100000')
      expect(input(root, 'e.g. 2').value).toBe('')
      expect(input(root, 'e.g. 2').getAttribute('aria-invalid')).toBe('false')
      expect(root.querySelector('.comparison')).not.toBeNull()
    })

    it('cleans stale values arriving via Back/Forward', async () => {
      const root = await load()
      act(() => {
        window.history.pushState(null, '', '/?business=Bakery')
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
      expect(count(root)).toBe('49 of 49 programs match')
      expect(window.location.search).toBe('')
    })
  })

  it('the empty-state Clear button resets typed text too', async () => {
    const root = await load()
    type(input(root, 'e.g. 250k'), '99m')
    type(input(root, 'e.g. 2'), 'two')
    expect(root.textContent).toContain('No programs match these details.')

    click(byText(root, 'button', 'Clear all filters'))

    expect(count(root)).toBe('49 of 49 programs match')
    expect(input(root, 'e.g. 250k').value).toBe('')
    expect(input(root, 'e.g. 2').value).toBe('')
  })
})
