// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import fixture from '../__fixtures__/programs.json'
import { click, keyDown, mount } from '../test/dom'
import type { Program, ProgramsResponse } from '../types'
import ProgramCard from './ProgramCard'

const { programs } = fixture as ProgramsResponse
const midwest = programs.find((p) => p.id === 'midwest-business-finance--504-loan')!

function setup(overrides: Partial<Parameters<typeof ProgramCard>[0]> = {}, program: Program = midwest) {
  const props = {
    program,
    expanded: false,
    recentUpdateDays: 7,
    onToggle: vi.fn(),
    compared: false,
    compareFull: false,
    onToggleCompare: vi.fn(),
    ...overrides,
  }
  const root = mount(<ProgramCard {...props} />)
  return {
    ...props,
    root,
    checkbox: root.querySelector<HTMLInputElement>('input[type="checkbox"]')!,
    summary: root.querySelector('.card-summary')!,
  }
}

describe('ProgramCard', () => {
  it('ticking Compare does not expand the card', () => {
    const { checkbox, onToggle, onToggleCompare } = setup()
    click(checkbox)
    expect(onToggleCompare).toHaveBeenCalledTimes(1)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('clicking the summary toggles the card', () => {
    const { summary, onToggle, onToggleCompare } = setup()
    click(summary)
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggleCompare).not.toHaveBeenCalled()
  })

  it.each(['Enter', ' '])('%j on the summary toggles without scrolling the page', (key) => {
    const { summary, onToggle } = setup()
    const event = keyDown(summary, key)
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores other keys', () => {
    const { summary, onToggle } = setup()
    expect(keyDown(summary, 'a').defaultPrevented).toBe(false)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('disables Compare and explains why when the comparison is full', () => {
    const { checkbox, root } = setup({ compareFull: true })
    expect(checkbox.disabled).toBe(true)
    expect(root.querySelector('.compare-toggle')!.getAttribute('title')).toBe('You can compare up to 3 programs')
  })

  it('reflects being in the comparison', () => {
    const { checkbox, root } = setup({ compared: true })
    expect(checkbox.checked).toBe(true)
    expect(checkbox.disabled).toBe(false)
    expect(root.querySelector('.card-compared')).not.toBeNull()
  })

  it('names the Compare checkbox after the program for screen readers', () => {
    const { root } = setup()
    expect(root.querySelector('.compare-toggle')!.textContent).toBe('CompareMidwest Business Finance 504 Loan')
  })

  it('shows the New rates badge only for recently updated programs', () => {
    expect(setup({}, { ...midwest, ratesRecentlyUpdated: true }).root.querySelector('.badge-new')).not.toBeNull()
    expect(setup({}, { ...midwest, ratesRecentlyUpdated: false }).root.querySelector('.badge-new')).toBeNull()
  })

  it('shows full details only when expanded', () => {
    const collapsed = setup()
    expect(collapsed.root.querySelector('.details')).toBeNull()
    expect(collapsed.summary.getAttribute('aria-expanded')).toBe('false')

    const expanded = setup({ expanded: true })
    expect(expanded.summary.getAttribute('aria-expanded')).toBe('true')
    const details = Object.fromEntries(
      [...expanded.root.querySelectorAll('.details > div')].map((d) => [d.querySelector('dt')!.textContent, d.querySelector('dd')!.textContent]),
    )
    expect(details).toMatchObject({
      'Loan amount': '$125,000 – $5,000,000',
      'Max term': '240 months (20 yrs)',
      'Max existing debt ratio': '45%',
      'Rates last updated': 'Feb 2, 2026',
    })
  })

  it('shows a fractional term in years and a missing debt ratio as not specified', () => {
    const { root } = setup({ expanded: true }, { ...midwest, maxTermMonths: 90, maxDebtRatio: null })
    expect(root.textContent).toContain('90 months (7.5 yrs)')
    expect(root.textContent).toContain('Not specified')
  })
})
